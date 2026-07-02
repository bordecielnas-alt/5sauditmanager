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
    else echo "No static build output found" && ls -la /app && ls -la /app/dist && exit 1; fi

# Runtime stage
FROM nginx:alpine
COPY --from=builder /app/docker-static /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
