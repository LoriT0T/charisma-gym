"""
Charisma Gym — backend entrypoint.

Run from the backend/ folder:
    uvicorn main:app --port 8000
Then open http://localhost:8000
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, WebSocket
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.websockets import WebSocketDisconnect

import config
from bridge import LiveBridge, MockBridge
from debrief import make_debrief
from personas import PERSONAS, RUBRIC, SCENARIOS, TECHNIQUES

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("main")

app = FastAPI(title="Charisma Gym")

VOICES = {
    "Algieba": "Smooth", "Puck": "Upbeat", "Fenrir": "Excitable", "Charon": "Informative",
    "Kore": "Firm", "Aoede": "Breezy", "Zephyr": "Bright", "Sadaltager": "Knowledgeable",
    "Algenib": "Gravelly", "Sulafat": "Warm", "Zubenelgenubi": "Casual", "Sadachbia": "Lively",
}


@app.get("/api/config")
async def get_config():
    return {
        "personas": {
            k: {"name": p["name"], "label": p["label"], "tagline": p["tagline"],
                "default_voice": p["default_voice"]}
            for k, p in PERSONAS.items()
        },
        "scenarios": {k: s["label"] for k, s in SCENARIOS.items()},
        "voices": VOICES,
        "rubric": {k: d["label"] for k, d in RUBRIC.items()},
        "techniques": {
            name: {"source": t["source"], "definition": t["definition"]}
            for name, t in TECHNIQUES.items()
        },
        "mock_mode": config.MOCK_MODE,
        "has_key": bool(config.GEMINI_API_KEY),
        "passcode_required": bool(config.APP_PASSCODE),
        "input_rate": config.INPUT_RATE,
        "output_rate": config.OUTPUT_RATE,
    }


def _code_ok(code: str | None) -> bool:
    import hmac
    if not config.APP_PASSCODE:
        return True
    return hmac.compare_digest((code or "").strip(), config.APP_PASSCODE)


@app.get("/api/checkcode")
async def checkcode(code: str = ""):
    return {"ok": _code_ok(code)}


@app.websocket("/ws")
async def ws_endpoint(
    ws: WebSocket,
    persona: str = "blend",
    scenario: str = "freestyle",
    voice: str = "",
    code: str = "",
):
    await ws.accept()
    if not _code_ok(code):
        await ws.send_json({"type": "error", "message": "Wrong passcode — check it and try again."})
        await ws.close()
        return
    if config.MOCK_MODE:
        bridge = MockBridge(ws, persona, scenario, voice or None)
    elif not config.GEMINI_API_KEY:
        await ws.send_json(
            {"type": "error",
             "message": "No GEMINI_API_KEY set. Add it to backend/.env (see .env.example), "
                        "or set MOCK_MODE=1 to try the interface without a key."}
        )
        await ws.close()
        return
    else:
        bridge = LiveBridge(ws, persona, scenario, voice or None)
    try:
        await bridge.run()
    except WebSocketDisconnect:
        pass
    except Exception as e:
        log.exception("bridge crashed")
        try:
            await ws.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        try:
            await ws.close()
        except Exception:
            pass
    log.info(
        "session over: %d transcript turns, %d analyses",
        len(bridge.transcript), len(bridge.feedback_history),
    )


class DebriefRequest(BaseModel):
    persona: str = "blend"
    transcript: list[dict]
    feedback_history: list[dict] = []
    code: str = ""


@app.post("/api/debrief")
async def debrief(req: DebriefRequest):
    if not _code_ok(req.code):
        return JSONResponse({"markdown": "**Wrong passcode** — refresh and re-enter it."}, status_code=403)
    if config.MOCK_MODE:
        client = None
    else:
        from google import genai
        client = genai.Client(api_key=config.GEMINI_API_KEY) if config.GEMINI_API_KEY else None
    md = await make_debrief(client, req.persona, req.transcript, req.feedback_history)
    if client is not None and req.transcript:
        # the friend quietly remembers you — fire and forget
        import asyncio as _asyncio
        from memory import update_memory
        _asyncio.create_task(update_memory(client, req.transcript))
    return JSONResponse({"markdown": md})


@app.get("/api/memory")
async def get_memory(code: str = ""):
    if not _code_ok(code):
        return JSONResponse({"error": "wrong passcode"}, status_code=403)
    from memory import load_memory
    return load_memory()


@app.post("/api/memory/forget")
async def forget_memory(code: str = ""):
    if not _code_ok(code):
        return JSONResponse({"error": "wrong passcode"}, status_code=403)
    from memory import MEMORY_PATH
    try:
        MEMORY_PATH.unlink(missing_ok=True)
    except Exception:
        pass
    return {"ok": True}


# ---- static frontend (kept in its own top-level folder: ../frontend) ----

@app.get("/")
async def index():
    return FileResponse(config.FRONTEND_DIR / "index.html")


app.mount("/", StaticFiles(directory=config.FRONTEND_DIR), name="frontend")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=config.HOST, port=config.PORT)
