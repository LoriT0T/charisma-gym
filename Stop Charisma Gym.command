#!/bin/zsh
pkill -f "uvicorn main:app" 2>/dev/null
pkill -f "cloudflared tunnel --url" 2>/dev/null
echo "Charisma Gym stopped."
sleep 1
