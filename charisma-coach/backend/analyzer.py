"""
The silent analyst in the booth.

Every time the user finishes a spoken turn, the bridge hands the transcript to
`analyze_turn`, which asks a fast Gemini text model to score the turn against
the six-dimension charisma rubric and pick ONE technique-tagged tip. Runs as a
fire-and-forget task so it never blocks the voice stream.
"""
from __future__ import annotations

import json
import logging
from typing import Optional

from google import genai
from google.genai import types
from pydantic import BaseModel, Field

import config
from personas import TECHNIQUES, rubric_cheatsheet, techniques_cheatsheet

log = logging.getLogger("analyzer")


class TurnScores(BaseModel):
    energy: int = Field(ge=0, le=100)
    wit: int = Field(ge=0, le=100)
    curiosity: int = Field(ge=0, le=100)
    story: int = Field(ge=0, le=100)
    confidence: int = Field(ge=0, le=100)
    presence: int = Field(ge=0, le=100)


class TurnAnalysis(BaseModel):
    scores: TurnScores
    overall: int = Field(ge=0, le=100, description="Overall charisma of this turn")
    strength: str = Field(description="One short sentence: the most charismatic thing they did, quoting their words if possible")
    technique: str = Field(description="EXACT name of one technique from the library that would most improve this turn")
    tip: str = Field(description="One punchy, specific, actionable sentence applying that technique to what they just said. Max 28 words.")
    filler_count: int = Field(ge=0, description="Count of filler words (um, uh, like, you know, sort of, I guess) in the turn")


_ANALYZER_SYSTEM = f"""You are a world-class conversation analyst, scoring ONE turn spoken aloud by a person practicing the art of talking.
Score against this rubric (0-100 each; 50 = ordinary small talk, 70+ = genuinely magnetic, below 35 = flat):

{rubric_cheatsheet()}

Technique library (your `technique` field MUST be one of these exact names):

{techniques_cheatsheet()}

Rules:
- Judge ONLY the trainee's latest turn, using the prior exchange as context for presence/responsiveness.
- This is spoken conversation, not writing: reward vividness, play, risk, warmth; punish hedging, fillers, resume-speak, ignoring the partner.
- Be honest and a little tough — inflated scores help nobody. Vary scores meaningfully between dimensions.
- The tip must be concrete enough to try in the very next sentence they speak, and reference their actual words/topic.
- Answer in the same spirit regardless of the trainee's language; write strength/tip in the trainee's language (default English)."""


VALID_TECHNIQUES = set(TECHNIQUES.keys())


def _closest_technique(name: str) -> str:
    """Snap a possibly-mangled technique name back to the library."""
    if name in VALID_TECHNIQUES:
        return name
    low = (name or "").lower()
    for t in VALID_TECHNIQUES:
        if t.lower() in low or low in t.lower():
            return t
    return "The Second Question"


class Analyst:
    def __init__(self, client: Optional[genai.Client]):
        self.client = client
        self.model = config.TEXT_MODEL
        self._fallbacks = list(config.TEXT_MODEL_FALLBACKS)

    async def analyze_turn(self, user_turn: str, context: list[dict]) -> Optional[dict]:
        """Return an analysis payload for the frontend, or None on failure."""
        if self.client is None:
            return None
        convo = "\n".join(
            f"{'THEIR FRIEND' if t['role'] == 'coach' else 'SPEAKER'}: {t['text']}"
            for t in context[-config.ANALYZER_CONTEXT_TURNS:]
        )
        prompt = (
            f"Recent exchange:\n{convo or '(conversation just started)'}\n\n"
            f"SPEAKER'S LATEST TURN (score this):\n\"{user_turn}\""
        )
        last_err: Exception | None = None
        for model in [self.model] + self._fallbacks:
            try:
                resp = await self.client.aio.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=_ANALYZER_SYSTEM,
                        response_mime_type="application/json",
                        response_schema=TurnAnalysis,
                        temperature=0.4,
                    ),
                )
                data = json.loads(resp.text)
                analysis = TurnAnalysis.model_validate(data)
                self.model = model  # remember what worked
                technique = _closest_technique(analysis.technique)
                return {
                    "type": "feedback",
                    "turn_text": user_turn,
                    "scores": analysis.scores.model_dump(),
                    "overall": analysis.overall,
                    "strength": analysis.strength,
                    "tip": {
                        "technique": technique,
                        "source": TECHNIQUES[technique]["source"],
                        "text": analysis.tip,
                    },
                    "filler_count": analysis.filler_count,
                }
            except Exception as e:  # model missing, quota, parse error...
                last_err = e
                log.warning("analyze_turn failed on %s: %s", model, e)
                continue
        log.error("analyze_turn: all models failed (%s)", last_err)
        return None


def coach_note_from(analysis: dict) -> str:
    """Turn the latest analysis into a stage direction for the live coach."""
    s = analysis["scores"]
    weakest = min(s, key=s.get)
    tip = analysis["tip"]
    return (
        "[PRIVATE NOTE — a thought crosses your mind about how your friend has been talking. "
        f"Your instincts say: energy {s['energy']}, wit {s['wit']}, curiosity {s['curiosity']}, "
        f"story {s['story']}, confidence {s['confidence']}, presence {s['presence']} — "
        f"weakest right now: {weakest}. The move that would unlock them: {tip['technique']} — {tip['text']} "
        "They just asked how they're coming across. Answer as their honest friend, in your own voice: "
        "one thing you loved (quote their words), one 'you know what you should do more?' built on that "
        "move, then dive straight back into the conversation so they can try it.]"
    )
