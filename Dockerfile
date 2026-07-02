# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json bun.lock* ./
RUN npm install -g bun && bun install --frozen-lockfile
COPY . .
RUN bun run build

# Runtime stage
FROM nginx:alpine
COPY --from=builder /app/.output/public /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
