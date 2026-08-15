"""
The friend's memory — small, human, persistent.

A single JSON file holds what your friends know about you: your name, durable
facts, and running jokes worth bringing back. It's injected into every call's
system prompt and updated quietly after each recap.
"""
from __future__ import annotations

import json
import logging
from typing import Optional

from google import genai
from google.genai import types
from pydantic import BaseModel, Field

import config

log = logging.getLogger("memory")

MEMORY_PATH = config.MEMORY_PATH
MAX_FACTS = 40
MAX_MOMENTS = 12


def load_memory() -> dict:
    try:
        with open(MEMORY_PATH, encoding="utf-8") as f:
            data = json.load(f)
        return {
            "name": data.get("name") or "",
            "facts": list(data.get("facts") or []),
            "moments": list(data.get("moments") or []),
        }
    except Exception:
        return {"name": "", "facts": [], "moments": []}


def save_memory(mem: dict) -> None:
    try:
        with open(MEMORY_PATH, "w", encoding="utf-8") as f:
            json.dump(mem, f, ensure_ascii=False, indent=2)
    except Exception as e:
        log.warning("could not save memory: %s", e)


def memory_prompt() -> str:
    mem = load_memory()
    if not (mem["name"] or mem["facts"] or mem["moments"]):
        return ""
    lines = []
    if mem["name"]:
        lines.append(f"- Their name: {mem['name']}")
    for f in mem["facts"]:
        lines.append(f"- {f}")
    if mem["moments"]:
        lines.append("Running jokes and moments you two share (bring one back when it fits):")
        for m in mem["moments"]:
            lines.append(f"  * {m}")
    return "\n".join(lines)


class MemoryUpdate(BaseModel):
    name: Optional[str] = Field(default=None, description="Their first name if it was said or corrected this call, else null")
    new_facts: list[str] = Field(default_factory=list, description="Up to 5 NEW durable facts about the friend not already known (job, interests, people in their life, preferences, ongoing situations). Each a short standalone sentence.")
    new_moments: list[str] = Field(default_factory=list, description="Up to 3 running jokes, funny phrases, or shared moments from THIS call worth bringing back later. Short.")


async def update_memory(client: genai.Client, transcript: list[dict]) -> None:
    """Extract new memories from a finished call and merge them in."""
    if not transcript:
        return
    mem = load_memory()
    convo = "\n".join(
        f"{'FRIEND' if t['role'] == 'coach' else 'USER'}: {t['text']}" for t in transcript
    )
    known = "\n".join(mem["facts"]) or "(nothing yet)"
    prompt = (
        f"Already known about the user:\n{known}\n\n"
        f"Known name: {mem['name'] or '(unknown)'}\n\n"
        f"CALL TRANSCRIPT:\n{convo}\n\n"
        "Extract only NEW, durable, non-sensitive memories about the USER (not the friend). "
        "Skip anything already known, anything medical/financial/intimate, and one-off trivia."
    )
    for model in [config.TEXT_MODEL] + config.TEXT_MODEL_FALLBACKS:
        try:
            resp = await client.aio.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=MemoryUpdate,
                    temperature=0.2,
                ),
            )
            upd = MemoryUpdate.model_validate(json.loads(resp.text))
            if upd.name:
                mem["name"] = upd.name.strip()[:40]
            for f in upd.new_facts[:5]:
                if f and f not in mem["facts"]:
                    mem["facts"].append(f.strip())
            for m in upd.new_moments[:3]:
                if m and m not in mem["moments"]:
                    mem["moments"].append(m.strip())
            mem["facts"] = mem["facts"][-MAX_FACTS:]
            mem["moments"] = mem["moments"][-MAX_MOMENTS:]
            save_memory(mem)
            log.info("memory updated: %d facts, %d moments", len(mem["facts"]), len(mem["moments"]))
            return
        except Exception as e:
            log.warning("memory update failed on %s: %s", model, e)
            continue
