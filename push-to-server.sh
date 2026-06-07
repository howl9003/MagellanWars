#!/bin/bash
# Run this from your LOCAL machine to upload the project to Oracle Cloud.
# Usage: ./push-to-server.sh <server-ip> [ssh-key-path]
#
# Example:
#   ./push-to-server.sh 140.238.1.23
#   ./push-to-server.sh 140.238.1.23 ~/.ssh/oracle_key

SERVER_IP="${1:?Usage: $0 <server-ip> [ssh-key-path]}"
SSH_KEY="${2:-~/.ssh/id_rsa}"
SSH_USER="ubuntu"
REMOTE_DIR="~/MagellanWars"

SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no"

echo "=== Uploading project to ${SSH_USER}@${SERVER_IP}:${REMOTE_DIR} ==="
rsync -avz --progress \
  --exclude '.git' \
  --exclude '*.o' \
  --exclude 'src/apps/archspace/*.o' \
  -e "ssh $SSH_OPTS" \
  "$(dirname "$0")/" \
  "${SSH_USER}@${SERVER_IP}:${REMOTE_DIR}/"

echo ""
echo "=== Running server setup (first time only) ==="
ssh $SSH_OPTS ${SSH_USER}@${SERVER_IP} \
  "sudo bash ${REMOTE_DIR}/server-setup.sh"

echo ""
echo "=== Deploying ==="
ssh $SSH_OPTS ${SSH_USER}@${SERVER_IP} \
  "cd ${REMOTE_DIR} && bash deploy.sh"
