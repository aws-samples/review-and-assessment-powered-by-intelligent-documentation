FROM --platform=linux/arm64 ghcr.io/astral-sh/uv:python3.13-bookworm-slim

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-cache

COPY . ./

EXPOSE 8080

CMD ["uv", "run", "opentelemetry-instrument", "python", "index.py"]
