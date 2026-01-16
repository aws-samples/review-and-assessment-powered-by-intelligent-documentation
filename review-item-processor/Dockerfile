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

COPY . ./

EXPOSE 8080

CMD ["uv", "run", "opentelemetry-instrument", "uvicorn", "index:app", "--host", "0.0.0.0", "--port", "8080"]
