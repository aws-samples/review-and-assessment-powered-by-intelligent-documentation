FROM --platform=linux/arm64 ghcr.io/astral-sh/uv:python3.13-bookworm-slim

WORKDIR /app

# Install Node.js 20 LTS for npx support
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Verify installations
RUN python --version && node --version && npm --version

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-cache

# Constraints for uv/uvx dependency resolution of MCP servers (caps mcp<2;
# see the file for why). Applied to the build-time install below; at runtime
# tools/mcp_tool.py injects it as UV_CONSTRAINT into the env of stdio MCP
# child processes only. Deliberately NOT set as a container-wide ENV here so
# the agent's own `uv run` startup (UV_OFFLINE/UV_NO_SYNC below) is unaffected.
COPY mcp-uv-constraints.txt ./mcp-uv-constraints.txt

# Install MCP Proxy for AWS (for Gateway IAM authentication)
RUN uv tool install --constraints ./mcp-uv-constraints.txt mcp-proxy-for-aws

COPY . ./

EXPOSE 8080

# 依存関係はイメージビルド時に uv sync --frozen で確定済みのため、起動時の
# 再同期とネットワーク取得を無効化する。VPC 配置（特に閉域）では起動時に
# インターネットへ出られず失敗するため必須で、それ以外の構成でも無害。
# Dependencies are locked into the image at build time, so disable runtime
# re-sync and network fetches. Required when the runtime has no internet
# (VPC/closed placement) and harmless otherwise.
ENV UV_NO_SYNC=1 \
    UV_OFFLINE=1

CMD ["uv", "run", "--no-sync", "opentelemetry-instrument", "uvicorn", "index:app", "--host", "0.0.0.0", "--port", "8080"]
