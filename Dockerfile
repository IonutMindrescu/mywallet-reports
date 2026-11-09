# --- build: compilează aplicația (tsc + vite) ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- runtime: nginx servește fișierele statice pe portul 5660 ---
FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 5660
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:5660/ >/dev/null || exit 1
