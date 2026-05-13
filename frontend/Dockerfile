FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# ビルド時はプレースホルダー値でビルドし、ランタイムで置換する
ENV VITE_APP_API_ENDPOINT=__VITE_APP_API_ENDPOINT__
ENV VITE_APP_USER_POOL_ID=__VITE_APP_USER_POOL_ID__
ENV VITE_APP_USER_POOL_CLIENT_ID=__VITE_APP_USER_POOL_CLIENT_ID__
ENV VITE_APP_REGION=__VITE_APP_REGION__
ENV VITE_APP_VERSION=__VITE_APP_VERSION__
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx.conf.template /etc/nginx/conf.d/default.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
