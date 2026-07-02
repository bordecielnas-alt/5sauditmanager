# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json bun.lock* ./
RUN npm install -g bun && bun install --frozen-lockfile
COPY . .
RUN bun run build && \
    mkdir -p /app/docker-static && \
    if [ -d /app/dist/client ]; then cp -a /app/dist/client/. /app/docker-static/; \
    elif [ -d /app/.output/public ]; then cp -a /app/.output/public/. /app/docker-static/; \
    elif [ -d /app/dist/public ]; then cp -a /app/dist/public/. /app/docker-static/; \
    else echo "No static build output found" && ls -la /app && ls -la /app/dist && exit 1; fi && \
    if [ ! -f /app/docker-static/index.html ]; then \
      ENTRY_JS="$(basename "$(ls /app/docker-static/assets/index-*.js | head -n 1)")" && \
      STYLES_CSS="$(basename "$(ls /app/docker-static/assets/styles-*.css | head -n 1)")" && \
      printf '%s\n' \
        '<!doctype html>' \
        '<html lang="fr">' \
        '  <head>' \
        '    <meta charset="UTF-8" />' \
        '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />' \
        '    <title>Audit 5S — Suivi industriel</title>' \
        '    <meta name="description" content="Application de gestion et suivi des audits 5S en atelier." />' \
        "    <link rel=\"stylesheet\" crossorigin href=\"/assets/${STYLES_CSS}\" />" \
        "    <script type=\"module\" crossorigin src=\"/assets/${ENTRY_JS}\"></script>" \
        '  </head>' \
        '  <body></body>' \
        '</html>' \
        > /app/docker-static/index.html; \
    fi

# Runtime stage
FROM nginx:alpine
COPY --from=builder /app/docker-static /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
