# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

# Install ffmpeg for video thumbnail generation
RUN apk add --no-cache ffmpeg curl

# Create non-root user (use node user's existing group, pick a free UID/GID)
RUN addgroup -g 1001 plik && \
    adduser -u 1001 -G plik -s /bin/sh -D plik

WORKDIR /app

# Copy built application from build stage
COPY --from=build /app/.output .output
COPY --from=build /app/package.json .

# Create data and database directories
RUN mkdir -p /app/data /app/database && \
    chown -R plik:plik /app

USER plik

EXPOSE 3000

ENV NODE_ENV=production
ENV NUXT_DATA_PATH=/app/data
ENV NUXT_DATABASE_PATH=/app/database/plik.db

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", ".output/server/index.mjs"]
