#!/bin/bash
set -euo pipefail

# Deploy script — run from local machine
# Usage: ./deploy.sh <EC2_PUBLIC_IP>

EC2_IP="${1:?Usage: ./deploy.sh <EC2_PUBLIC_IP>}"
KEY="/Users/apdesai/Downloads/usEast1Key.pem"
DEPLOY_SRC="/Users/apdesai/Downloads/deploy"
PORTFOLIO_STUFF="/Users/apdesai/Downloads/portfolioStuff"
REMOTE_DIR="/opt/apps"
SSH="ssh -i $KEY -o StrictHostKeyChecking=no ec2-user@$EC2_IP"
SCP="scp -i $KEY -o StrictHostKeyChecking=no"

echo "=== Packaging project files ==="
TMPDIR=$(mktemp -d)

# Copy deploy-ec2 orchestration files
cp /Users/apdesai/Projects/apurva-portfolio/deploy-ec2/docker-compose.yml "$TMPDIR/"
cp /Users/apdesai/Projects/apurva-portfolio/deploy-ec2/Caddyfile "$TMPDIR/"
cp /Users/apdesai/Projects/apurva-portfolio/deploy-ec2/Dockerfile.generic "$TMPDIR/"
cp /Users/apdesai/Projects/apurva-portfolio/deploy-ec2/Dockerfile.ml "$TMPDIR/"

# Copy v1 projects from deploy folder
cp -r "$DEPLOY_SRC/wafsim-v1" "$TMPDIR/wafsim-v1"
cp -r "$DEPLOY_SRC/aquaSDG-v1" "$TMPDIR/aquasdg-v1"

# Copy wine app
cp -r "$PORTFOLIO_STUFF/wine-app-final" "$TMPDIR/wine-app-final"

# Copy v2 aquaSDG for later testing
cp -r "$PORTFOLIO_STUFF/new-mid-aquaSDG" "$TMPDIR/aquasdg-v2"

# Clean up node_modules and .next to reduce transfer size
find "$TMPDIR" -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
find "$TMPDIR" -name ".next" -type d -exec rm -rf {} + 2>/dev/null || true
find "$TMPDIR" -name ".DS_Store" -delete 2>/dev/null || true

echo "=== Creating tarball ==="
tar -czf /tmp/apps-deploy.tar.gz -C "$TMPDIR" .
rm -rf "$TMPDIR"

TARSIZE=$(du -h /tmp/apps-deploy.tar.gz | cut -f1)
echo "    Tarball size: $TARSIZE"

echo "=== Uploading to EC2 ==="
$SCP /tmp/apps-deploy.tar.gz "ec2-user@$EC2_IP:/tmp/apps-deploy.tar.gz"

echo "=== Extracting and building on EC2 ==="
$SSH << 'REMOTE'
set -euo pipefail
sudo mkdir -p /opt/apps
sudo chown ec2-user:ec2-user /opt/apps
cd /opt/apps

# Back up existing if present
if [ -f docker-compose.yml ]; then
  echo "Stopping existing services..."
  docker-compose down 2>/dev/null || true
fi

# Extract new files
tar -xzf /tmp/apps-deploy.tar.gz -C /opt/apps
rm /tmp/apps-deploy.tar.gz

echo "Building and starting services..."
docker-compose up --build -d

echo "Waiting for services to start..."
sleep 15

echo "=== Service Status ==="
docker-compose ps
REMOTE

echo ""
echo "=== Deploy complete ==="
echo "Services should be available at:"
echo "  https://wafsim.apurvad.xyz"
echo "  https://aquasdg.apurvad.xyz"
echo "  https://wine.apurvad.xyz"
echo ""
echo "SSH in to check: ssh -i $KEY ec2-user@$EC2_IP"

rm -f /tmp/apps-deploy.tar.gz
