# Build stage — TanStack Start SSR build with Node server preset
FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
# Force nitro to build a standalone Node server (default preset in the
# Lovable vite plugin is cloudflare workers, which won't run under Docker).
ENV NITRO_PRESET=node-server
RUN bun run build

# Runtime stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.output ./.output
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
