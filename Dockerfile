# Root Dockerfile for Coolify deployment (backend service)
# Build context is repo root — all paths relative to repo root

# ─── Build stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY backend/package*.json ./
COPY backend/prisma ./prisma/
COPY backend/prisma.config.ts ./

RUN npm ci --legacy-peer-deps

RUN npx prisma generate

COPY backend/ .

RUN npm run build

# Compile seed script separately (outside src/)
RUN npx tsc prisma/seed.ts \
    --ignoreConfig \
    --outDir dist/prisma \
    --module commonjs \
    --target ES2022 \
    --esModuleInterop \
    --skipLibCheck \
    --resolveJsonModule

# ─── Production stage ────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

COPY backend/package*.json ./
COPY backend/prisma ./prisma/
COPY backend/prisma.config.ts ./
RUN npm ci --omit=dev --legacy-peer-deps

RUN npx prisma generate

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/uploads

RUN addgroup -g 1001 -S nodejs && \
    adduser -S zipapp -u 1001 && \
    chown -R zipapp:nodejs /app/uploads

USER zipapp

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "dist/app.js"]
