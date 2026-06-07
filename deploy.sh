#!/bin/bash
# Run on the server to (re)build and start the game.
# Usage: ./deploy.sh
set -e

cd "$(dirname "$0")"

echo "=== Building images ==="
docker compose build

echo "=== Starting services ==="
docker compose up -d

echo "=== Status ==="
docker compose ps

PUBLIC_IP=$(curl -s --max-time 3 ifconfig.me 2>/dev/null || echo "<your-server-ip>")
echo ""
echo "Game is live at:  http://${PUBLIC_IP}"
echo "Register at:      http://${PUBLIC_IP}/register"
