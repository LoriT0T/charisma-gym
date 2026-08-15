#!/bin/zsh
# Good Company — health check. Answers one question: is my link actually alive?
# Run this any time the phone link seems dead.
cd "$(dirname "$0")"

echo "Good Company — health check"
echo "=================================================="

# 1. Is the local server up and answering?
if pgrep -f "uvicorn main:app" >/dev/null; then
  if curl -sf -o /dev/null --max-time 5 http://127.0.0.1:8787/api/config; then
    echo "  OK    Server is running and answering on 127.0.0.1:8787"
  else
    echo "  DEAD  Server process exists but is not answering — restart it."
    echo "        Fix: run 'Start Charisma Gym.command'"
    exit 1
  fi
else
  echo "  DEAD  Server is not running."
  echo "        Fix: run 'Start Charisma Gym.command'"
  exit 1
fi

# 2. Is the tunnel process up?
if pgrep -f "cloudflared tunnel --url" >/dev/null; then
  echo "  OK    Tunnel process is running"
else
  echo "  DEAD  Tunnel is not running — no public link."
  echo "        Fix: run 'Start Charisma Gym.command'"
  exit 1
fi

# 3. THE IMPORTANT ONE: does the public link actually serve traffic?
#    A running cloudflared proves nothing — a revoked quick tunnel retries
#    forever while serving nobody. That is what killed the last link.
URL=$(cat phone-link.txt 2>/dev/null)
if [ -z "$URL" ]; then
  echo "  WARN  No link recorded in phone-link.txt"
  exit 1
fi

CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$URL/api/config")
if [ "$CODE" = "200" ]; then
  echo "  OK    Public link is LIVE: $URL"
  echo "        Passcode: <door code — see backend/.env>"
  printf "%s" "$URL" | pbcopy
  echo "        (copied to clipboard)"
else
  echo "  DEAD  Public link is not serving (HTTP $CODE): $URL"
  echo "        The quick tunnel was revoked. Cloudflare cannot give the same"
  echo "        hostname back — you must mint a new one."
  echo "        Fix: run 'Start Charisma Gym.command'"
  exit 1
fi

# 4. Retry-loop detector — the signature of the zombie state.
RETRIES=$(grep -c "Serve tunnel error" logs/tunnel.log 2>/dev/null)
RETRIES=${RETRIES:-0}
if [ "$RETRIES" -gt 50 ]; then
  echo "  WARN  Tunnel log shows $RETRIES connection failures — restart soon."
fi

echo "=================================================="
echo "All good."
