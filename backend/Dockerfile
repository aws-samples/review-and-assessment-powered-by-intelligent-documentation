FROM --platform=linux/arm64 public.ecr.aws/docker/library/node:22
# Lambda Web Adapter を追加
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.0 /lambda-adapter /opt/extensions/lambda-adapter

# Install uv for MCP tool preview support
RUN curl -LsSf https://astral.sh/uv/install.sh | sh && \
    mv /root/.local/bin/uv /usr/local/bin/ && \
    mv /root/.local/bin/uvx /usr/local/bin/

WORKDIR /var/task
COPY package*.json ./
COPY prisma ./prisma

RUN npm ci --omit=dev && npm run prisma:generate
COPY . .
RUN npm run build

# Install MCP Proxy for AWS (for Gateway IAM authentication)
RUN /usr/local/bin/uv tool install mcp-proxy-for-aws

# 環境変数の設定
ENV PORT=8080
ENV AWS_LWA_READINESS_CHECK_PATH=/health
ENV AWS_LWA_ASYNC_INIT=false
ENV AWS_LWA_ENABLE_COMPRESSION=false
# UV cache directory for Lambda (writable location)
ENV UV_CACHE_DIR=/tmp/.uv
ENV UV_TOOL_DIR=/tmp/.uv/tools
# NPM/NPX cache directory for Lambda (writable location)
ENV NPM_CONFIG_CACHE=/tmp/.npm
ENV NPM_CONFIG_PREFIX=/tmp/.npm-global

# アプリケーションの起動
CMD ["node", "dist/api/index.js"]
