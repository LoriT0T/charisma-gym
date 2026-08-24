"""End-of-session debrief writer — the full report card, in the coach's voice."""
from __future__ import annotations

import logging
from typing import Optional

from google import genai
from google.genai import types

import config
from personas import PERSONAS, rubric_cheatsheet, techniques_cheatsheet

log = logging.getLogger("debrief")

_DEBRIEF_SYSTEM = f"""You are writing a warm, honest recap of a phone call between two friends — written BY the AI friend,
FOR the person they just talked with. The friend happens to be a master of conversation and quietly helps
the person get better at talking, the way charismatic friends rub off on you. Never use the words coach,
training, practice, session, exercise, or gym.

Rubric (for your judgment, not to be explained):
{rubric_cheatsheet()}

Technique library (cite techniques by exact name, tagged (Brand) or (Ferguson) — frame them as tricks the
great charmers use, gossip between friends, not curriculum):
{techniques_cheatsheet()}

Write the recap in Markdown with EXACTLY these sections:

# After the call
One warm paragraph in the friend's own voice about the talk you two just had, quoting 1-2 of their actual lines.

## The numbers
A compact table: each rubric dimension, average score for the call, one-phrase read. Present it with a wink — 'you know I keep score in my head'.

## Moments that landed
2-3 bullets. Their best moments — quote their actual words and name the technique they (perhaps accidentally) pulled off.

## Steal these next time
Exactly 2 Brand-school moves and 2 Ferguson-school moves, each: **Technique Name** (source) — one sentence on precisely where in THIS conversation it would have been delicious, quoting the moment.

## Three things to try
3 numbered, concrete, playful things to try in their next conversation with anyone (e.g. "Go one whole coffee chat without saying sorry", "Answer one question non-literally", "Hold one two-second pause and just smile"). Frame each as an X+1: name the situation's required minimum (X), then the one small step past it — the step must be tiny, never a performance.

## From {{friend_name}}
2-3 sentences in the friend's voice — affectionate, memorable, a little theatrical. Sign off with their name.

Rules: quote the person's real words wherever possible; be specific, never generic; keep the whole thing under 600 words; write in the person's language (default English)."""


async def make_debrief(
    client: Optional[genai.Client],
    persona_key: str,
    transcript: list[dict],
    feedback_history: list[dict],
) -> str:
    persona = PERSONAS.get(persona_key, PERSONAS["blend"])
    if client is None or not transcript:
        return _fallback_debrief(persona, feedback_history)

    convo = "\n".join(
        f"{persona['name'].upper() if t['role'] == 'coach' else 'THEM'}: {t['text']}"
        for t in transcript
    )
    avg = _averages(feedback_history)
    scores_line = (
        ", ".join(f"{k}: {v}" for k, v in avg.items()) if avg else "no per-turn scores captured"
    )
    prompt = (
        f"The friend writing this recap: {persona['name']} ({persona['tagline']})\n"
        f"Per-turn analyzer averages for the call: {scores_line}\n"
        f"Number of the person's turns analyzed: {len(feedback_history)}\n\n"
        f"FULL CALL TRANSCRIPT:\n{convo}\n\n"
        f"Write the recap now. The final section heading is exactly: ## From {persona['name']}"
    )
    for model in [config.TEXT_MODEL] + config.TEXT_MODEL_FALLBACKS:
        try:
            resp = await client.aio.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=_DEBRIEF_SYSTEM, temperature=0.7
                ),
            )
            if resp.text:
                return resp.text
        except Exception as e:
            log.warning("debrief failed on %s: %s", model, e)
            continue
    return _fallback_debrief(persona, feedback_history)


def _averages(feedback_history: list[dict]) -> dict:
    if not feedback_history:
        return {}
    keys = feedback_history[0]["scores"].keys()
    return {
        k: round(sum(f["scores"][k] for f in feedback_history) / len(feedback_history))
        for k in keys
    }


def _fallback_debrief(persona: dict, feedback_history: list[dict]) -> str:
    avg = _averages(feedback_history)
    lines = ["# After the call", ""]
    if avg:
        lines += ["## The numbers", "", "| Dimension | Avg |", "|---|---|"]
        lines += [f"| {k.title()} | {v} |" for k, v in avg.items()]
        lines += [""]
    lines += [
        "I couldn't write you the full recap this time — but the short version is: "
        "you called, we talked, and that beats every book on charisma ever written.",
        "",
        f"— {persona['name']}",
    ]
    return "\n".join(lines)
