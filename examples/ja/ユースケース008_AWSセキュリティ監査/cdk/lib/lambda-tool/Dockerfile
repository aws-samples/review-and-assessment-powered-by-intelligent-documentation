FROM public.ecr.aws/lambda/nodejs:22

# Install tar, gzip, Python 3.13 and uv
RUN dnf install -y tar gzip python3.13 python3.13-pip && \
    curl -LsSf https://astral.sh/uv/install.sh | sh

# Set environment variables for write permissions
ENV HOME=/tmp
ENV AWS_CONFIG_FILE=/tmp/.aws/config
ENV UV_CACHE_DIR=/tmp/.uv
ENV UV_TOOL_DIR=/tmp/.uv/tools
ENV PATH="${PATH}:/root/.cargo/bin"

# Copy handler code
COPY handler.ts package.json tsconfig.json ./
RUN npm install && npm run build

CMD ["index.handler"]
