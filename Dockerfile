# syntax=docker/dockerfile:1.7

# ---------- build stage ----------
FROM node:20-bookworm-slim AS build
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g bun@1.3.3

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# Rebuild better-sqlite3 for node runtime (compile native binding against node headers)
RUN cd node_modules/better-sqlite3 && npm rebuild better-sqlite3 --build-from-source || true

# ---------- runtime stage ----------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends nginx supervisor ca-certificates tzdata \
  && rm -rf /var/lib/apt/lists/* \
  && rm -f /etc/nginx/sites-enabled/default

ENV TZ=Europe/Paris
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=127.0.0.1
ENV DB_PATH=/data/audit5s.db
ENV UPLOADS_DIR=/data/uploads

COPY --from=build /app/.output ./.output
# better-sqlite3 native binding is required at runtime
COPY --from=build /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=build /app/node_modules/bindings ./node_modules/bindings
COPY --from=build /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path

COPY nginx.conf /etc/nginx/conf.d/audit-5s.conf
COPY supervisord.conf /etc/supervisord.conf

RUN mkdir -p /data/uploads
VOLUME ["/data"]

EXPOSE 80

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
