#!/bin/bash
# Run this ONCE on the server after deploy to get the initial SSL certificate.
# After this, certbot auto-renews every 12 hours.
set -e

DOMAIN="playvibespace.online"
EMAIL="admin@playvibespace.online"

echo "=== Creating certbot directories ==="
mkdir -p ./certbot/www ./certbot/conf

echo "=== Starting nginx on HTTP only (for ACME challenge) ==="
# Temporarily use an HTTP-only config so nginx can start without a cert
cat > /tmp/nginx-init.conf << 'EOF'
events {}
http {
    server {
        listen 80;
        server_name playvibespace.online www.playvibespace.online;
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        location / {
            return 200 'waiting for SSL...';
            add_header Content-Type text/plain;
        }
    }
}
EOF

docker compose stop nginx 2>/dev/null || true
docker run --rm -d --name nginx-init \
  -p 80:80 \
  -v "$(pwd)/certbot/www:/var/www/certbot" \
  -v "/tmp/nginx-init.conf:/etc/nginx/nginx.conf:ro" \
  nginx:alpine

echo "=== Requesting certificate from Let's Encrypt ==="
docker run --rm \
  -v "$(pwd)/certbot/www:/var/www/certbot" \
  -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  certbot/certbot certonly \
    --webroot --webroot-path=/var/www/certbot \
    --email "$EMAIL" --agree-tos --no-eff-email \
    -d "$DOMAIN" -d "www.$DOMAIN"

echo "=== Stopping temporary nginx ==="
docker stop nginx-init

echo "=== Restarting stack with SSL ==="
docker compose up -d

echo ""
echo "Done! https://${DOMAIN} should now be live."
