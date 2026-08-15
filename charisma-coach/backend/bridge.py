"""
The bridge: one browser WebSocket <-> one Gemini Live voice session.

Browser -> server:
  binary frames        raw 16-bit PCM mono @16kHz mic audio
  {"type":"coach_read"}         user tapped "Coach, read me" — inject booth note
  {"type":"text","text":...}    optional typed message into the conversation
  {"type":"end"}                finish session (frontend then POSTs /api/debrief)

Server -> browser:
  binary frames        raw 16-bit PCM mono @24kHz coach audio
  {"type":"status", ...}                    connection / model info
  {"type":"input_transcript","text","final"}   what the user said (live)
  {"type":"output_transcript","text","final"}  what the coach said (live)
  {"type":"interrupted"}                    user barged in — flush playback
  {"type":"turn_complete"}                  coach finished a turn
  {"type":"feedback", ...}                  analyzer verdict for a user turn
  {"type":"session_expired"}                Live API session hit its time limit
  {"type":"error","message"}
"""
from __future__ import annotations

import asyncio
import json
import logging
import math
import struct
from typing import Optional

from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect, WebSocketState

from google import genai
from google.genai import types

import config
from analyzer import Analyst, coach_note_from
from memory import memory_prompt
from personas import PERSONAS, build_system_prompt

log = logging.getLogger("bridge")


class SocketSender:
    """Serializes concurrent sends onto one browser websocket."""

    def __init__(self, ws: WebSocket):
        self.ws = ws
        self._lock = asyncio.Lock()

    async def json(self, payload: dict):
        async with self._lock:
            if self.ws.client_state == WebSocketState.CONNECTED:
                await self.ws.send_text(json.dumps(payload))

    async def audio(self, pcm: bytes):
        async with self._lock:
            if self.ws.client_state == WebSocketState.CONNECTED:
                await self.ws.send_bytes(pcm)


class LiveBridge:
    def __init__(self, ws: WebSocket, persona: str, scenario: str, voice: str | None):
        self.ws = ws
        self.out = SocketSender(ws)
        self.persona_key = persona if persona in PERSONAS else "blend"
        self.scenario_key = scenario
        self.voice = voice or PERSONAS[self.persona_key]["default_voice"]
        self.client = genai.Client(api_key=config.GEMINI_API_KEY)
        self.analyst = Analyst(self.client)
        self.transcript: list[dict] = []       # [{role: user|coach, text}]
        self.feedback_history: list[dict] = []
        self._user_buf: list[str] = []
        self._coach_buf: list[str] = []
        self._pending_analysis: set[asyncio.Task] = set()
        self._ended = asyncio.Event()

    # ---------------- Gemini connection ----------------

    def _live_config(self) -> types.LiveConnectConfig:
        return types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            system_instruction=build_system_prompt(
                self.persona_key, self.scenario_key, memory_prompt()
            ),
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=self.voice)
                )
            ),
            input_audio_transcription={},
            output_audio_transcription={},
            context_window_compression=types.ContextWindowCompressionConfig(
                trigger_tokens=25600,
                sliding_window=types.SlidingWindow(target_tokens=12800),
            ),
        )

    async def run(self):
        last_err: Exception | None = None
        for model in [config.LIVE_MODEL] + config.LIVE_MODEL_FALLBACKS:
            try:
                async with self.client.aio.live.connect(
                    model=model, config=self._live_config()
                ) as session:
                    await self.out.json(
                        {"type": "status", "state": "connected", "model": model,
                         "persona": self.persona_key, "voice": self.voice}
                    )
                    # Kick the coach into an opening line before the user speaks.
                    await session.send_client_content(
                        turns=types.Content(
                            role="user",
                            parts=[types.Part(text="[PRIVATE NOTE — your friend just picked up the call. Greet them with your opening move now.]")],
                        ),
                        turn_complete=True,
                    )
                    await self._pump(session)
                    return
            except WebSocketDisconnect:
                return
            except Exception as e:
                last_err = e
                msg = str(e).lower()
                if any(k in msg for k in ("not found", "not supported", "permission", "does not exist", "invalid model")):
                    log.warning("live model %s unavailable (%s); trying next", model, e)
                    continue
                log.exception("live session error on %s", model)
                await self.out.json({"type": "error", "message": f"Live session error: {e}"})
                return
        await self.out.json(
            {"type": "error",
             "message": f"No Live model available for this API key. Last error: {last_err}. "
                        "Run `python doctor.py` in the backend folder to see which models your key can use."}
        )

    async def _pump(self, session):
        up = asyncio.create_task(self._browser_to_gemini(session), name="up")
        down = asyncio.create_task(self._gemini_to_browser(session), name="down")
        try:
            done, pending = await asyncio.wait({up, down}, return_when=asyncio.FIRST_COMPLETED)
            for t in pending:
                t.cancel()
            for t in done:
                exc = t.exception()
                if exc and not isinstance(exc, (WebSocketDisconnect, asyncio.CancelledError)):
                    raise exc
        finally:
            for t in self._pending_analysis:
                t.cancel()

    # ---------------- upstream: browser -> gemini ----------------

    async def _browser_to_gemini(self, session):
        while not self._ended.is_set():
            message = await self.ws.receive()
            if message.get("type") == "websocket.disconnect":
                raise WebSocketDisconnect(code=message.get("code", 1000))
            if (data := message.get("bytes")) is not None:
                await session.send_realtime_input(
                    audio=types.Blob(data=data, mime_type=f"audio/pcm;rate={config.INPUT_RATE}")
                )
            elif (text := message.get("text")) is not None:
                await self._handle_control(session, json.loads(text))

    async def _handle_control(self, session, msg: dict):
        kind = msg.get("type")
        if kind == "end":
            self._ended.set()
            await self.out.json({"type": "status", "state": "ended"})
            raise WebSocketDisconnect(code=1000)
        elif kind == "coach_read":
            note = (
                coach_note_from(self.feedback_history[-1])
                if self.feedback_history
                else "[PRIVATE NOTE — a thought crosses your mind: they just asked how they're coming "
                     "across, before saying much at all. Tease them warmly for asking for a review two "
                     "minutes into a phone call, then toss them an inviting question.]"
            )
            await session.send_client_content(
                turns=types.Content(role="user", parts=[types.Part(text=note)]),
                turn_complete=True,
            )
        elif kind == "text":
            user_text = (msg.get("text") or "").strip()
            if user_text:
                self._commit_user_turn(user_text)
                await session.send_client_content(
                    turns=types.Content(role="user", parts=[types.Part(text=user_text)]),
                    turn_complete=True,
                )

    # ---------------- downstream: gemini -> browser ----------------

    async def _gemini_to_browser(self, session):
        try:
            while not self._ended.is_set():
                # receive() yields one complete coach turn, then ends; loop re-enters.
                async for response in session.receive():
                    if response.go_away is not None:
                        await self.out.json({"type": "session_expiring"})
                        continue
                    sc = response.server_content
                    if sc is None:
                        continue
                    if sc.interrupted:
                        await self.out.json({"type": "interrupted"})
                        self._flush_coach_buf(partial=True)
                    if sc.input_transcription and sc.input_transcription.text:
                        self._user_buf.append(sc.input_transcription.text)
                        await self.out.json(
                            {"type": "input_transcript",
                             "text": "".join(self._user_buf), "final": False}
                        )
                    if sc.output_transcription and sc.output_transcription.text:
                        # Coach is responding => the user's turn is committed.
                        self._maybe_commit_user_buf()
                        self._coach_buf.append(sc.output_transcription.text)
                        await self.out.json(
                            {"type": "output_transcript",
                             "text": "".join(self._coach_buf), "final": False}
                        )
                    if sc.model_turn:
                        self._maybe_commit_user_buf()
                        for part in sc.model_turn.parts or []:
                            if part.inline_data and part.inline_data.data:
                                await self.out.audio(part.inline_data.data)
                    if sc.turn_complete:
                        text = "".join(self._coach_buf).strip()
                        self._coach_buf.clear()
                        if text:
                            self.transcript.append({"role": "coach", "text": text})
                            await self.out.json(
                                {"type": "output_transcript", "text": text, "final": True}
                            )
                        await self.out.json({"type": "turn_complete"})
        except Exception as e:
            # Server closed the stream: 15-min session limit, network drop, etc.
            if not self._ended.is_set():
                log.info("live session closed: %s", e)
                self._flush_coach_buf(partial=True)
                await self.out.json({"type": "session_expired"})
                self._ended.set()

    # ---------------- turn bookkeeping ----------------

    def _maybe_commit_user_buf(self):
        if self._user_buf:
            text = "".join(self._user_buf).strip()
            self._user_buf.clear()
            if text:
                self._commit_user_turn(text)

    def _commit_user_turn(self, text: str):
        self.transcript.append({"role": "user", "text": text})
        asyncio.create_task(
            self.out.json({"type": "input_transcript", "text": text, "final": True})
        )
        task = asyncio.create_task(self._analyze(text))
        self._pending_analysis.add(task)
        task.add_done_callback(self._pending_analysis.discard)

    def _flush_coach_buf(self, partial: bool = False):
        if self._coach_buf:
            text = "".join(self._coach_buf).strip()
            self._coach_buf.clear()
            if text:
                full = text + (" —" if partial else "")
                self.transcript.append({"role": "coach", "text": full})
                asyncio.create_task(
                    self.out.json({"type": "output_transcript", "text": full, "final": True})
                )

    async def _analyze(self, user_text: str):
        if len(user_text.split()) < config.MIN_WORDS_TO_ANALYZE:
            return
        try:
            result = await self.analyst.analyze_turn(user_text, self.transcript)
        except Exception as e:
            log.warning("analysis crashed: %s", e)
            return
        if result:
            self.feedback_history.append(result)
            await self.out.json(result)


# =========================================================================
# Mock bridge — full UI behavior with zero API calls (MOCK_MODE=1)
# =========================================================================

_MOCK_SCRIPT = [
    {
        "user": "Um, hi, I guess... so, yeah, I work in marketing and stuff. It's fine.",
        "coach": "Marketing! You magnificent merchant of dreams. And yet you announced it like a man confessing to a parking ticket. Come on — sell ME the parking ticket. What's the strangest thing you've ever had to make sound exciting?",
        "feedback": {
            "scores": {"energy": 31, "wit": 24, "curiosity": 18, "story": 22, "confidence": 28, "presence": 45},
            "overall": 28,
            "strength": "You showed up and answered without deflecting — that's a base to build on.",
            "technique": "The Verbal Swoop",
            "tip": "Replace 'it's fine' with one extravagant sentence about marketing, then puncture it — 'I sell dreams, mate. Mostly about yogurt.'",
            "filler": 3,
        },
    },
    {
        "user": "Ha, okay — honestly the weirdest was a campaign for industrial glue. I spent three weeks of my life finding ways to make glue sound sexy.",
        "coach": "Three weeks! In the sultry universe of INDUSTRIAL ADHESIVES. And now, an awkward pause while we both picture the billboard... See, that's a story with stakes, darling. Did the glue campaign work, or did the whole thing come unstuck?",
        "feedback": {
            "scores": {"energy": 58, "wit": 64, "curiosity": 30, "story": 71, "confidence": 55, "presence": 62},
            "overall": 61,
            "strength": "'Make glue sound sexy' — a vivid, self-aware image with real comic stakes. That's a story engine.",
            "technique": "The Second Question",
            "tip": "Now flip it — ask the coach something about THEIR absurd job. Curiosity is the half of charisma you're leaving on the table.",
            "filler": 1,
        },
    },
    {
        "user": "It came unstuck, completely. But wait — what about you, what's the weirdest thing YOU'VE ever had to sell?",
        "coach": "Oh, LOOK at you, turning the anchor's desk around! I once had to sell silence to a room full of drummers, and I nearly died. 'It came unstuck' — you're doing callbacks now, you gorgeous quick study. Right: tell me about the moment the glue campaign died. Slowly. I want the crime scene.",
        "feedback": {
            "scores": {"energy": 66, "wit": 70, "curiosity": 82, "story": 58, "confidence": 68, "presence": 78},
            "overall": 71,
            "strength": "'It came unstuck' — a callback AND a pun, plus you finally made the coach the subject. Textbook Anchor Heist.",
            "technique": "The Callback Trophy",
            "tip": "You've minted 'unstuck' — now bring it back one more time later tonight and it becomes a running bit.",
            "filler": 0,
        },
    },
]


def _mock_voice_chunk(seconds: float, base_freq: float, sample_rate: int) -> bytes:
    """Vaguely speech-shaped audio so the orb has something to dance to."""
    n = int(seconds * sample_rate)
    frames = bytearray()
    for i in range(n):
        t = i / sample_rate
        syllable = 0.55 + 0.45 * math.sin(2 * math.pi * 4.2 * t + math.sin(t * 2.1))
        vibrato = math.sin(2 * math.pi * (base_freq + 9 * math.sin(2 * math.pi * 5 * t)) * t)
        overtone = 0.35 * math.sin(2 * math.pi * base_freq * 2.7 * t)
        env = min(1.0, i / 800, (n - i) / 1600)
        sample = int(9000 * env * syllable * (vibrato + overtone))
        frames += struct.pack("<h", max(-32767, min(32767, sample)))
    return bytes(frames)


class MockBridge:
    """Replays a scripted session: reacts to mic audio with canned turns."""

    def __init__(self, ws: WebSocket, persona: str, scenario: str, voice: str | None):
        self.ws = ws
        self.out = SocketSender(ws)
        self.persona_key = persona if persona in PERSONAS else "blend"
        self.transcript: list[dict] = []
        self.feedback_history: list[dict] = []
        self._idx = 0
        self._audio_seen = 0
        self._busy = False

    async def run(self):
        await self.out.json(
            {"type": "status", "state": "connected", "model": "mock-mode",
             "persona": self.persona_key, "voice": "Mock"}
        )
        await asyncio.sleep(0.6)
        await self._coach_turn(
            "Well, there you are! I was just thinking about you, which is either sweet or "
            "deeply suspicious. Come on then — tell me about your day, and make it at least "
            "eleven percent more interesting than the truth."
        )
        try:
            while True:
                message = await self.ws.receive()
                if message.get("type") == "websocket.disconnect":
                    return
                if message.get("bytes") is not None:
                    self._audio_seen += len(message["bytes"])
                    # ~1.6s of speech at 16kHz/16-bit triggers the next beat
                    if self._audio_seen > 16000 * 2 * 1.6 and not self._busy:
                        self._audio_seen = 0
                        asyncio.create_task(self._scripted_beat())
                elif message.get("text") is not None:
                    msg = json.loads(message["text"])
                    if msg.get("type") == "end":
                        await self.out.json({"type": "status", "state": "ended"})
                        return
                    if msg.get("type") == "coach_read" and not self._busy:
                        asyncio.create_task(
                            self._coach_turn(
                                "How are you coming across? Honestly? Your energy's climbing, your "
                                "wit is waking up, and your curiosity finally got out of bed. You know "
                                "what you should do more? The awkward pause — say something, then "
                                "just... hold it. Anyway — back to the glue crime scene."
                            )
                        )
                    if msg.get("type") == "text" and msg.get("text"):
                        self.transcript.append({"role": "user", "text": msg["text"]})
        except WebSocketDisconnect:
            return

    async def _scripted_beat(self):
        self._busy = True
        try:
            beat = _MOCK_SCRIPT[self._idx % len(_MOCK_SCRIPT)]
            self._idx += 1
            # progressive user transcript
            words = beat["user"].split(" ")
            for i in range(2, len(words) + 1, 3):
                await self.out.json(
                    {"type": "input_transcript", "text": " ".join(words[:i]), "final": False}
                )
                await asyncio.sleep(0.12)
            await self.out.json({"type": "input_transcript", "text": beat["user"], "final": True})
            self.transcript.append({"role": "user", "text": beat["user"]})
            # analyzer verdict arrives while coach replies
            fb = beat["feedback"]
            feedback = {
                "type": "feedback",
                "turn_text": beat["user"],
                "scores": fb["scores"],
                "overall": fb["overall"],
                "strength": fb["strength"],
                "tip": {
                    "technique": fb["technique"],
                    "source": "brand" if fb["technique"] in ("The Verbal Swoop",) else "ferguson",
                    "text": fb["tip"],
                },
                "filler_count": fb["filler"],
            }
            self.feedback_history.append(feedback)
            asyncio.get_running_loop().call_later(
                1.2, lambda: asyncio.create_task(self.out.json(feedback))
            )
            await self._coach_turn(beat["coach"])
        finally:
            self._busy = False

    async def _coach_turn(self, text: str):
        self._busy = True
        try:
            words = text.split(" ")
            shown = 0
            n_chunks = max(6, len(words) // 4)
            for c in range(n_chunks):
                shown = min(len(words), shown + max(2, len(words) // n_chunks))
                await self.out.json(
                    {"type": "output_transcript", "text": " ".join(words[:shown]), "final": False}
                )
                await self.out.audio(
                    _mock_voice_chunk(0.28, 150 + 40 * math.sin(c * 1.7), config.OUTPUT_RATE)
                )
                await asyncio.sleep(0.26)
            await self.out.json({"type": "output_transcript", "text": text, "final": True})
            self.transcript.append({"role": "coach", "text": text})
            await self.out.json({"type": "turn_complete"})
        finally:
            self._busy = False
