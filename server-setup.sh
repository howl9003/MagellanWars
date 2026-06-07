#!/bin/bash
# Run this ONCE on a fresh Ubuntu 22.04/24.04 VM (AWS, Oracle, etc.)
# It installs Docker and opens the firewall, then you run deploy.sh.
set -e

echo "=== Installing Docker ==="
apt-get update -qq
apt-get install -y -qq ca-certificates curl

# Docker's official GPG key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

# Add Docker apt repo (works for 22.04 and 24.04)
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

usermod -aG docker ubuntu 2>/dev/null || true

echo "=== Opening firewall ports ==="
# AWS security groups handle the external firewall, but Ubuntu 24.04
# ships with ufw enabled by default — open port 80 there too.
if command -v ufw &>/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp
  ufw allow 443/tcp
fi

echo "=== Docker installed ==="
docker --version
docker compose version
echo ""
echo "Done! Now run ./deploy.sh to build and start the game."
