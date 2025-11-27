FROM --platform=linux/arm64 ghcr.io/astral-sh/uv:python3.13-bookworm-slim

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-cache

COPY . ./

EXPOSE 8080

CMD ["uv", "run", "opentelemetry-instrument", "uvicorn", "index:app", "--host", "0.0.0.0", "--port", "8080"]
