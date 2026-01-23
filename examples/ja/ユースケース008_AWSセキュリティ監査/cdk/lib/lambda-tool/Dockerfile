FROM public.ecr.aws/lambda/python:3.13

# Install AWS CLI v2 and other dependencies
RUN microdnf install -y unzip && \
    curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "/tmp/awscliv2.zip" && \
    unzip /tmp/awscliv2.zip -d /tmp && \
    /tmp/aws/install && \
    rm -rf /tmp/awscliv2.zip /tmp/aws && \
    microdnf clean all

# Install uv (keeping for potential future use of aws-api-mcp-server)
RUN pip install uv

# Set environment variables
ENV HOME=/tmp
ENV UV_CACHE_DIR=/tmp/.uv
ENV UV_TOOL_DIR=/tmp/.uv/tools
ENV PATH="${PATH}:/root/.local/bin:/usr/local/bin"

# Pre-install aws-api-mcp-server (optional, for future use)
RUN uv tool install awslabs.aws-api-mcp-server@latest

# Copy Lambda function
COPY lambda_function.py ${LAMBDA_TASK_ROOT}/

CMD ["lambda_function.lambda_handler"]
