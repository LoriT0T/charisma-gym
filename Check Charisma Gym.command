#!/bin/zsh
# Charisma Gym — health check.
# Checks the PERMANENT Render deployment first (that's the real app), then the
# optional local dev server. Run this any time something seems off.
cd "$(dirname "$0")"

LIVE_URL="https://charisma-gym.onrender.com"

echo "Charisma Gym — health check"
echo "=================================================="

# ---------- 1. The permanent deployment (what actually matters) ----------
echo "  Checking $LIVE_URL ..."
echo "  (a cold start after 15 min idle can take ~60s — this waits)"

OK=0
for i in {1..12}; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$LIVE_URL/api/config")
  if [ "$CODE" = "200" ]; then OK=1; break; fi
  sleep 5
done

if [ "$OK" = "1" ]; then
  echo "  OK    LIVE: $LIVE_URL"
  HAS_KEY=$(curl -s --max-time 20 "$LIVE_URL/api/config" | grep -o '"has_key":[a-z]*' | cut -d: -f2)
  if [ "$HAS_KEY" = "true" ]; then
    echo "  OK    GEMINI_API_KEY is set on the host"
  else
    echo "  WARN  GEMINI_API_KEY missing on the host — calls will fail."
    echo "        Fix: Render dashboard -> charisma-gym -> Environment"
  fi
  printf "%s" "$LIVE_URL" | pbcopy
  echo "        (link copied to clipboard)"
else
  echo "  DEAD  $LIVE_URL not responding (last HTTP $CODE)"
  echo "        Check the deploy logs: https://dashboard.render.com"
fi

# ---------- 2. Local dev server (optional) ----------
echo "--------------------------------------------------"
if curl -sf -o /dev/null --max-time 5 http://127.0.0.1:8787/api/config 2>/dev/null; then
  DOOR=$(grep -E "^APP_PASSCODE=" charisma-coach/backend/.env 2>/dev/null | cut -d= -f2- | tr -d "[:space:]")
  echo "  OK    Local dev server up on 127.0.0.1:8787"
  echo "        Door code: ${DOOR:-(see backend/.env)}"
else
  echo "  --    Local dev server not running (fine — Render is the real app)"
  echo "        Start it only for development: 'Start Charisma Gym.command'"
fi

# ---------- 3. Legacy tunnel ----------
if pgrep -f "cloudflared tunnel --url" >/dev/null; then
  RETRIES=$(grep -c "Serve tunnel error" logs/tunnel.log 2>/dev/null)
  RETRIES=${RETRIES:-0}
  echo "  --    A cloudflared tunnel is still running ($RETRIES errors)."
  echo "        Superseded by Render. Stop it with 'Stop Charisma Gym.command'."
fi

echo "=================================================="
[ "$OK" = "1" ] && echo "All good." || exit 1
