#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# HeimspielRadar Mac-to-Pi Deployment Script
#
# Builds the linux/arm64 Docker image on the local Mac using Docker Buildx,
# streams it directly over SSH to the Raspberry Pi, copies Docker Compose
# configuration, and restarts the backend container.
# ==============================================================================

PI_HOST="${PI_HOST:-${1:-pi@raspberrypi.local}}"
PI_DIR="${PI_DIR:-~/heimspielradar}"
IMAGE_TAG="heimspielradar-backend:latest"

echo "============================================================"
echo "🎯 HeimspielRadar Deployment Target"
echo "============================================================"
echo "Host:      $PI_HOST"
echo "Directory: $PI_DIR"
echo "Image:     $IMAGE_TAG (platform: linux/arm64)"
echo "------------------------------------------------------------"
echo "Tip: Override via environment variables or first argument:"
echo "     PI_HOST=pi@192.168.178.50 npm run docker:deploy-pi"
echo "     ./scripts/deploy-pi.sh pi@192.168.178.50"
echo "============================================================"

# Ensure script runs from project root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Step 1: Build multi-arch Docker image locally
echo ""
echo "🚀 [1/5] Building Docker image for linux/arm64..."
docker buildx build --platform linux/arm64 -t "$IMAGE_TAG" --load .

# Step 2: Ensure remote deployment directory exists
echo ""
echo "📁 [2/5] Ensuring remote target directory exists on $PI_HOST..."
ssh "$PI_HOST" "mkdir -p $PI_DIR"

# Step 3: Stream Docker image archive directly over SSH
echo ""
echo "📡 [3/5] Streaming Docker image to $PI_HOST over SSH..."
docker save "$IMAGE_TAG" | ssh "$PI_HOST" 'docker load'

# Step 4: Copy configuration files
echo ""
echo "📄 [4/5] Syncing Docker Compose configuration..."
scp docker-compose.yml "$PI_HOST:$PI_DIR/docker-compose.yml"

# Copy .env template only if no .env exists on remote
if ssh "$PI_HOST" "[ ! -f $PI_DIR/.env ]"; then
  echo "⚠️  No .env file found at $PI_HOST:$PI_DIR/.env"
  echo "   Copying .env.example as starting template..."
  scp .env.example "$PI_HOST:$PI_DIR/.env"
  echo "⚠️  ACTION REQUIRED: SSH into $PI_HOST and edit $PI_DIR/.env with your DATABASE_URL!"
else
  echo "✅ Remote .env file already exists. Preserving existing secrets."
fi

# Step 5: Start / restart container via Docker Compose
echo ""
echo "🔄 [5/5] Starting container via Docker Compose on $PI_HOST..."
ssh "$PI_HOST" "cd $PI_DIR && docker compose up -d"

echo ""
echo "============================================================"
echo "🔍 Health & Status Verification"
echo "============================================================"
sleep 3
ssh "$PI_HOST" "cd $PI_DIR && docker compose ps"

echo ""
echo "📜 Recent container logs:"
ssh "$PI_HOST" "cd $PI_DIR && docker compose logs --tail=25 backend"

echo ""
echo "============================================================"
echo "🎉 Deployment to $PI_HOST completed successfully!"
echo "============================================================"
echo "To tail logs continuously:"
echo "  ssh $PI_HOST 'cd $PI_DIR && docker compose logs -f backend'"
