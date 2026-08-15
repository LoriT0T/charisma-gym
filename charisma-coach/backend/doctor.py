"""
Key & model checkup. Run from the backend/ folder:

    python doctor.py

Verifies your GEMINI_API_KEY, lists which models your key can see, tests the
text model used by the analyzer, and does a 3-second handshake with the Live
voice model. Prints exactly what to fix if something's wrong.
"""
import asyncio
import sys

import config


def _ok(msg):
    print(f"  \033[92mOK\033[0m  {msg}")


def _bad(msg):
    print(f"  \033[91mXX\033[0m  {msg}")


async def main() -> int:
    print("\nCharisma Gym — doctor\n" + "=" * 40)

    if not config.GEMINI_API_KEY:
        _bad("No GEMINI_API_KEY in backend/.env")
        print("      Get a free key at https://aistudio.google.com/apikey and put it in backend/.env")
        return 1
    key = config.GEMINI_API_KEY
    _ok(f"Key found ({key[:6]}...{key[-4:]}, {len(key)} chars)")

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=key)

    # 1) Can we list models?
    try:
        models = [m.name.removeprefix("models/") async for m in await client.aio.models.list()]
        _ok(f"Key is valid — {len(models)} models visible")
    except Exception as e:
        _bad(f"Could not list models: {e}")
        print("      This usually means the key is invalid or the wrong kind of key.")
        print("      Make one at https://aistudio.google.com/apikey (it should start with 'AIza' or 'AQ.').")
        return 1

    live_like = [m for m in models if "live" in m or "native-audio" in m]
    print(f"      Live-capable models your key can see: {live_like or 'none listed (may still work)'}")

    # 2) Text model for the analyzer
    text_ok = None
    for model in [config.TEXT_MODEL] + config.TEXT_MODEL_FALLBACKS:
        try:
            r = await client.aio.models.generate_content(
                model=model, contents="Say OK and nothing else."
            )
            if r.text:
                text_ok = model
                break
        except Exception:
            continue
    if text_ok:
        _ok(f"Analyzer text model works: {text_ok}")
        if text_ok != config.TEXT_MODEL:
            print(f"      (Tip: set TEXT_MODEL={text_ok} in backend/.env)")
    else:
        _bad(f"No analyzer text model responded (tried {[config.TEXT_MODEL] + config.TEXT_MODEL_FALLBACKS})")

    # 3) Live voice handshake
    live_ok = None
    for model in [config.LIVE_MODEL] + config.LIVE_MODEL_FALLBACKS:
        try:
            async with client.aio.live.connect(
                model=model,
                config=types.LiveConnectConfig(response_modalities=["AUDIO"]),
            ) as session:
                await session.send_client_content(
                    turns=types.Content(role="user", parts=[types.Part(text="Say hi in two words.")]),
                    turn_complete=True,
                )
                got_audio = False
                async for msg in session.receive():
                    sc = msg.server_content
                    if sc and sc.model_turn:
                        for part in sc.model_turn.parts or []:
                            if part.inline_data and part.inline_data.data:
                                got_audio = True
                    if sc and sc.turn_complete:
                        break
                if got_audio:
                    live_ok = model
                    break
        except Exception as e:
            print(f"      live model {model}: {type(e).__name__}: {str(e)[:120]}")
            continue
    if live_ok:
        _ok(f"Live voice model works: {live_ok}")
        if live_ok != config.LIVE_MODEL:
            print(f"      (Tip: set LIVE_MODEL={live_ok} in backend/.env)")
    else:
        _bad("No Live voice model worked with this key.")
        print("      Check https://ai.google.dev/gemini-api/docs/live for current model names,")
        print("      then set LIVE_MODEL=<name> in backend/.env")

    print()
    return 0 if (text_ok and live_ok) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
