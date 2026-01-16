FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

# Set writable environment variables for ECS Task (read-only root filesystem)
ENV HOME=/tmp
ENV UV_CACHE_DIR=/tmp/.uv
ENV UV_TOOL_DIR=/tmp/.uv/tools
ENV PYTHONUNBUFFERED=1

# Copy application code
WORKDIR /app
COPY requirements.txt server.py ./

# Install Python dependencies
RUN uv pip install --system -r requirements.txt

# Expose MCP server port (required by AgentCore Runtime)
EXPOSE 8000

# Run FastMCP server with streamable-http transport (MUST use uv per CLAUDE.md instructions)
# AgentCore Runtime connects to http://localhost:8000/mcp
CMD ["uv", "run", "server.py"]
