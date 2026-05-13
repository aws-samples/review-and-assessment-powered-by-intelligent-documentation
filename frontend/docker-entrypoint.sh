#!/bin/sh
# ランタイムで環境変数をビルド済みファイルに注入する
# プレースホルダーを実際の環境変数値で置換する
find /usr/share/nginx/html -type f \( -name '*.js' -o -name '*.html' \) -exec sed -i \
  -e "s|__VITE_APP_API_ENDPOINT__|${VITE_APP_API_ENDPOINT}|g" \
  -e "s|__VITE_APP_USER_POOL_ID__|${VITE_APP_USER_POOL_ID}|g" \
  -e "s|__VITE_APP_USER_POOL_CLIENT_ID__|${VITE_APP_USER_POOL_CLIENT_ID}|g" \
  -e "s|__VITE_APP_REGION__|${VITE_APP_REGION}|g" \
  -e "s|__VITE_APP_VERSION__|${VITE_APP_VERSION}|g" \
  {} +

# nginx設定テンプレートの環境変数を展開
if [ -f /etc/nginx/conf.d/default.conf.template ]; then
  envsubst '${BACKEND_API_URL} ${BACKEND_API_HOST}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
fi

exec "$@"
