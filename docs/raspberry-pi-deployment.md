# Raspberry Pi Docker Deployment Guide

This guide documents deploying the HeimspielRadar backend to a Raspberry Pi 4 or 5 (64-bit ARM) running 24/7 for scheduled DBB match syncing against Neon PostgreSQL.

---

## 1. Architecture & Overview

HeimspielRadar utilizes a streamlined Mac-to-Pi deployment pipeline:

```
┌─────────────────────────────────┐                 ┌─────────────────────────────────┐
│     Developer Mac (Apple Silicon) │                 │     Raspberry Pi 4 / 5 (ARM64)   │
│                                 │                 │                                 │
│  1. `docker buildx` compiles     │  Streaming SSH  │  3. `docker load` imports image │
│     multi-stage linux/arm64     │ ───────────────>│  4. `docker compose up -d`      │
│  2. `docker save` image stream  │     Tunnel      │  5. NestJS boots, applies Neon   │
│                                 │                 │     migrations, runs cron syncs │
└─────────────────────────────────┘                 └─────────────────────────────────┘
```

Key features:
- **Zero Pi Compilation**: Fast local build on Mac via Docker Buildx; the Pi never struggles with npm installs or webpack builds.
- **Direct SSH Streaming**: `docker save ... | ssh pi@host 'docker load'` eliminates the need for an external Docker registry.
- **Lean Runtime**: Node 22 Alpine non-root image with production dependencies only.
- **Automated Neon Syncs**: Automated cron schedules (`CRON_DELTA_SCHEDULE` and `CRON_DEEP_SCHEDULE`) run independently 24/7.
- **Monolithic SPA Serving**: Optional frontend static assets served under `/` alongside `/api/*` endpoints (ADR-0001).

---

## 2. Raspberry Pi Prerequisites & Setup

### 2.1 Raspberry Pi OS 64-bit
Ensure your Raspberry Pi runs a 64-bit OS (e.g. Raspberry Pi OS Bookworm 64-bit or Ubuntu 64-bit):
```bash
uname -m
# Expected output: aarch64
```

### 2.2 Install Docker & Docker Compose
Install Docker using the official automated installer script:
```bash
# 1. Download and run the Docker installation script
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 2. Add the pi user to the docker group (avoids needing sudo for docker commands)
sudo usermod -aG docker $USER

# 3. Apply group changes (or log out and log back in)
newgrp docker

# 4. Verify installation
docker --version
docker compose version
```

### 2.3 Configure Passwordless SSH Access from Mac
The deployment script requires passwordless SSH access to stream Docker images and control Docker Compose.

On your **Mac**:
```bash
# 1. Generate an SSH key if you do not have one
test -f ~/.ssh/id_ed25519 || ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519

# 2. Copy the public key to your Raspberry Pi
ssh-copy-id pi@raspberrypi.local
# (or replace with your Pi's IP address: ssh-copy-id pi@192.168.178.xxx)

# 3. Test that SSH connects without prompting for a password
ssh pi@raspberrypi.local "echo 'SSH connection successful!'"
```

---

## 3. Remote Directory & Environment Configuration

On the **Raspberry Pi**, create the deployment directory and configure `.env`:

```bash
# 1. Create target directory
mkdir -p ~/heimspielradar
cd ~/heimspielradar

# 2. Create the .env configuration file
nano .env
```

Add your production environment variables to `~/heimspielradar/.env`:

```env
# Neon PostgreSQL Connection URL
DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-cool-fog-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require"

# Enable cron scrapers (default: true)
ENABLE_CRON_SYNC=true

# Schedule for delta syncs (e.g. daily at 05:00 and 18:00)
CRON_DELTA_SCHEDULE="0 5,18 * * *"

# Schedule for deep weekly full syncs (e.g. Tuesdays at 02:00 AM)
CRON_DEEP_SCHEDULE="0 2 * * 2"

# Port mapping (default: 3000)
PORT=3000

# Optional Scraper Webhook API secret
SCRAPER_SECRET="your-strong-random-secret"
```

Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).

---

## 4. Mac-to-Pi Deployment

From the root of the repository on your **Mac**, trigger the deployment:

### Default Deployment
If `PI_HOST` is defined in your `.env.local` (e.g. `PI_HOST="pi@rpi"`), simply run:
```bash
npm run docker:deploy-pi
```
Otherwise, it defaults to `pi@raspberrypi.local`.

### Custom Hostname / IP Address
If your Pi uses a custom IP or username, you can also override via environment variable or CLI argument:
```bash
PI_HOST="pi@192.168.178.50" npm run docker:deploy-pi
```
Or execute the script directly:
```bash
./scripts/deploy-pi.sh pi@192.168.178.50
```

### Custom Remote Directory
```bash
PI_HOST="pi@192.168.178.50" PI_DIR="/opt/heimspielradar" npm run docker:deploy-pi
```

### What the Script Executes:
1. Builds `linux/arm64` image locally via `docker buildx build --platform linux/arm64 -t heimspielradar-backend:latest --load .`.
2. Connects over SSH to ensure remote directory `~/heimspielradar` exists.
3. Streams the image archive directly into the Pi's Docker daemon: `docker save ... | ssh ... 'docker load'`.
4. Copies `docker-compose.yml` (and seeds `.env` if not present).
5. Starts or restarts the service: `docker compose up -d`.
6. Tails recent logs to confirm database connection and migrations.

---

## 5. Operations & Monitoring

SSH into your Raspberry Pi to manage the running container:

```bash
ssh pi@raspberrypi.local
cd ~/heimspielradar
```

### View Live Backend Logs
```bash
docker compose logs -f backend
```

### Check Container Health Status
```bash
docker compose ps
```
The container status will report `healthy` once `GET /api/health` succeeds.

### Test Health Endpoint Manually
```bash
curl -i http://localhost:3000/api/health
```
Expected output:
```json
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"status":"ok","timestamp":"2026-10-24T22:30:00.000Z","lastSyncedAt":"2026-10-24T18:00:00.000Z"}
```

### Restart or Stop Service
```bash
# Restart container
docker compose restart backend

# Stop service
docker compose down

# Start service
docker compose up -d
```

---

## 6. Troubleshooting

### Permission Denied on Docker Socket
If `docker load` fails on the Pi with `permission denied while trying to connect to the Docker daemon socket`:
Run on the Pi:
```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Neon Database SSL Connection
Ensure `sslmode=require` is present in the `DATABASE_URL` query parameters:
```env
DATABASE_URL="postgresql://...?sslmode=require"
```

### Port 3000 Already in Use
If another service on the Pi is using port 3000, specify a different external port in `~/heimspielradar/.env`:
```env
PORT=3001
```
The backend remains listening on port 3000 inside the container, with Docker mapping `3001:3000`.
