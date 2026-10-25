# syntax=docker/dockerfile:1

# ==============================================================================
# Stage 1: Build Backend & Frontend
# ==============================================================================
FROM --platform=$BUILDPLATFORM node:22-alpine AS builder

WORKDIR /app

# Install dependencies based on root lockfile
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and workspace configuration
COPY . .

# Pass build arg and env for enabling admin dashboard on Pi
ARG VITE_ENABLE_ADMIN_UI=true
ENV VITE_ENABLE_ADMIN_UI=$VITE_ENABLE_ADMIN_UI

# Build backend and frontend
RUN npx nx build backend && npx nx build frontend

# ==============================================================================
# Stage 2: Lean Production Runtime
# ==============================================================================
FROM node:22-alpine AS runner

# Install curl for container healthcheck
RUN apk add --no-cache curl

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# Copy generated package manifests from backend dist
COPY --from=builder /app/dist/apps/backend/package.json ./package.json
COPY --from=builder /app/dist/apps/backend/package-lock.json ./package-lock.json

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled backend bundle
COPY --from=builder /app/dist/apps/backend/main.js ./main.js
COPY --from=builder /app/dist/apps/backend/main.js.map* ./

# Copy database migrations for automatic startup migration execution
COPY --from=builder /app/drizzle/migrations ./drizzle/migrations

# Copy compiled frontend for monolithic static serving (ADR-0001)
COPY --from=builder /app/dist/apps/frontend ./dist/apps/frontend

# Ensure non-root node user owns application files
RUN chown -R node:node /app

# Run as non-root user
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "main.js"]
