#!/bin/bash
set -euo pipefail

# Backup script — run on EC2 or locally via SSH
# Creates volume snapshots and uploads to S3

BUCKET="apurvad-xyz-failover"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/tmp/backup-$TIMESTAMP"

mkdir -p "$BACKUP_DIR"

echo "=== Backing up Docker volumes ==="
cd /opt/apps

# Export aquasdg database
docker-compose exec -T aquasdg-next cat /data/dev.db > "$BACKUP_DIR/aquasdg-dev.db" 2>/dev/null || echo "No aquasdg db to backup"

# Export compose config for reference
cp docker-compose.yml "$BACKUP_DIR/"
cp Caddyfile "$BACKUP_DIR/"

echo "=== Creating backup archive ==="
tar -czf "/tmp/apps-backup-$TIMESTAMP.tar.gz" -C "$BACKUP_DIR" .
rm -rf "$BACKUP_DIR"

echo "=== Uploading to S3 ==="
aws s3 cp "/tmp/apps-backup-$TIMESTAMP.tar.gz" \
  "s3://$BUCKET/backups/apps-backup-$TIMESTAMP.tar.gz" \
  --region us-east-1

rm -f "/tmp/apps-backup-$TIMESTAMP.tar.gz"

echo "=== Backup complete: s3://$BUCKET/backups/apps-backup-$TIMESTAMP.tar.gz ==="
