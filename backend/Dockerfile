# ─── Build stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install all dependencies (including dev for build)
RUN npm ci --legacy-peer-deps

# Generate Prisma client
RUN npx prisma generate

# Copy source
COPY . .

# Build TypeScript (app)
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

# Copy package files and install production only
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN npm ci --omit=dev --legacy-peer-deps

# Generate Prisma client in production
RUN npx prisma generate

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create uploads directory
RUN mkdir -p /app/uploads

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S zipapp -u 1001 && \
    chown -R zipapp:nodejs /app/uploads

USER zipapp

EXPOSE 3001

#ínstead of prisma generate at runtime, we use --url flag for db push
# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "dist/app.js"]
