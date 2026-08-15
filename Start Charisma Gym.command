#!/bin/zsh
# Good Company (Charisma Gym) — one-click start: server + public phone link
cd "$(dirname "$0")"
mkdir -p logs

echo "Stopping any previous instance..."
pkill -f "uvicorn main:app" 2>/dev/null
pkill -f "cloudflared tunnel --url" 2>/dev/null
sleep 1

# Keep logs from growing without bound (a dead tunnel can spew MBs of retries).
for f in logs/server.log logs/tunnel.log; do
  if [ -f "$f" ] && [ "$(stat -f%z "$f")" -gt 5000000 ]; then
    mv "$f" "$f.1"
  fi
done

echo "Starting the gym server..."
( cd charisma-coach/backend && nohup ../.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8787 >> ../../logs/server.log 2>&1 & )

# Don't announce a link until the server itself answers.
for i in {1..20}; do
  curl -sf -o /dev/null http://127.0.0.1:8787/api/config && break
  sleep 1
done
if ! curl -sf -o /dev/null http://127.0.0.1:8787/api/config; then
  echo "Server did not come up — check logs/server.log"
  exit 1
fi

# --protocol http2 is deliberate. This network blocks/throttles QUIC (UDP), which
# silently kills the tunnel's control stream and makes links look "expired".
# Diagnosed 2026-08-15. Do not remove without re-testing on this network.
echo "Opening the tunnel (this mints a fresh link each time)..."
nohup cloudflared tunnel --url http://127.0.0.1:8787 --protocol http2 > logs/tunnel.log 2>&1 &

URL=""
for i in {1..30}; do
  URL=$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' logs/tunnel.log | head -1)
  [ -n "$URL" ] && break
  sleep 1
done

if [ -z "$URL" ]; then
  echo "Tunnel did not come up — check logs/tunnel.log"
  exit 1
fi

# A URL in the log is NOT proof of a working tunnel. Verify it actually serves.
echo "Verifying the public link really works..."
OK=0
for i in {1..20}; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$URL/api/config")
  [ "$CODE" = "200" ] && OK=1 && break
  sleep 2
done

# keep the Mac from idle-sleeping while the gym is open (lid stays open)
UVPID=$(pgrep -f "uvicorn main:app" | head -1)
[ -n "$UVPID" ] && nohup caffeinate -i -w "$UVPID" >/dev/null 2>&1 &

if [ "$OK" = "1" ]; then
  echo "$URL" > phone-link.txt
  printf "%s" "$URL" | pbcopy
  echo ""
  echo "=================================================="
  echo "  Good Company is LIVE (verified)"
  echo "  Phone link (also copied to clipboard):"
  echo "  $URL"
  echo "  Passcode: <door code — see backend/.env>"
  echo "=================================================="
  echo ""
  echo "The link changes each restart; the fresh one is always in phone-link.txt"
  sleep 2
  open "$URL"
else
  echo ""
  echo "Tunnel came up but the public link is NOT serving traffic."
  echo "  Tried: $URL"
  echo "  This is the failure mode that silently killed the last link."
  echo "  Just run this script again — it mints a new one."
  exit 1
fi
