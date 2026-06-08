#!/bin/bash
# Run on the server to (re)build and start the game.
# Usage: ./deploy.sh
set -e

cd "$(dirname "$0")"

# Stop the old C++ stack if it's still running
if docker compose ps --quiet 2>/dev/null | grep -q .; then
    echo "=== Stopping legacy stack ==="
    docker compose down
fi

echo "=== Building new stack images (this takes a few minutes) ==="
docker compose -f docker-compose.new.yml build

echo "=== Starting new stack ==="
docker compose -f docker-compose.new.yml up -d

echo "=== Status ==="
docker compose -f docker-compose.new.yml ps

PUBLIC_IP=$(curl -s --max-time 3 ifconfig.me 2>/dev/null || echo "<your-server-ip>")
echo ""
echo "Game is live at:  https://${PUBLIC_IP}"
echo "  (or https://playvibespace.online once DNS resolves)"
