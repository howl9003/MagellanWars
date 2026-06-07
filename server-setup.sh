#!/bin/bash
# Run this ONCE on a fresh Oracle Cloud Ubuntu VM.
# It installs Docker, pulls the project, and starts the game.
set -e

echo "=== Installing Docker ==="
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin

usermod -aG docker ubuntu 2>/dev/null || true

echo "=== Opening firewall ports ==="
# Oracle Cloud VMs have an internal iptables firewall in addition to the
# Security List. We must open port 80 here too.
iptables  -I INPUT  -p tcp --dport 80  -j ACCEPT
iptables  -I INPUT  -p tcp --dport 443 -j ACCEPT
# Persist across reboots
apt-get install -y -qq iptables-persistent
netfilter-persistent save

echo "=== Docker installed ==="
docker --version
docker compose version
echo ""
echo "Done! Now run ./deploy.sh to build and start the game."
