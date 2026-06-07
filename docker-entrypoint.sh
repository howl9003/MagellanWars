#!/bin/bash
set -e

DB_HOST="${DB_HOST:-db}"
DB_USER="${DB_USER:-archspace}"
DB_PASS="${DB_PASS:-archspace}"
DB_NAME="${DB_NAME:-Archspace2}"

echo "Waiting for MySQL at $DB_HOST..."
until mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" -e "SELECT 1" >/dev/null 2>&1; do
    sleep 2
done
echo "MySQL is up."

# Initialize DB if empty
TABLE_COUNT=$(mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" \
    -sNe "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME';" 2>/dev/null || echo 0)

if [ "$TABLE_COUNT" -eq 0 ]; then
    echo "Initializing database..."
    # Disable strict mode to allow TEXT columns with default values (MySQL 5.x compat)
    mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" \
        -e "SET GLOBAL sql_mode=''; SET sql_mode='';" 2>/dev/null || true
    mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" \
        --init-command="SET sql_mode=''" "$DB_NAME" < /var/archspace/all.sql
    echo "Database initialized."
fi

# Build message catalogs if .mo files missing
if [ ! -f /var/archspace/msg/en/LC_MESSAGES/archspace.mo ] 2>/dev/null; then
    echo "No message catalogs found, using default locale."
fi

export HOME=/var/archspace

echo "Starting archspace server on port 12345..."
exec /usr/sbin/archspace -c /etc/archspace/archspace.config
