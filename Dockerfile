# Multi-stage Dockerfile for NoJX - Debian-based with system Chromium
# Uses system Chromium (ARM64 compatible) instead of @sparticuz/chromium bundled binary

# ============================================
# Stage 1: Build
# ============================================
FROM node:20-slim AS build

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json yarn.lock ./

# Install production dependencies
RUN yarn install --frozen-lockfile --production=true && \
    yarn cache clean

# Copy application code
COPY bin/ ./bin/
COPY src/ ./src/
COPY lib/ ./lib/
COPY api/ ./api/
COPY public/ ./public/

# ============================================
# Stage 2: Release (Minimal)
# ============================================
FROM node:20-slim AS release

WORKDIR /app

# Install system Chromium and ALL required dependencies for puppeteer
# Based on puppeteer's official requirements for Debian
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    libxshmfence1 \
    ca-certificates \
    fonts-noto-color-emoji \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables
# Force puppeteer to use system Chromium instead of bundled
ENV NODE_ENV=production \
    PORT=3000 \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Copy only the built application from build stage
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/bin/ ./bin/
COPY --from=build /app/src/ ./src/
COPY --from=build /app/lib/ ./lib/
COPY --from=build /app/api/ ./api/
COPY --from=build /app/public/ ./public/
COPY --from=build /app/package.json ./package.json

# Expose the API port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000/api/up || exit 1

# Run the server
ENTRYPOINT ["node", "bin/cli.js", "server"]
