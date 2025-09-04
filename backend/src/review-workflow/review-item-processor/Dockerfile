FROM public.ecr.aws/lambda/python:3.13-arm64

# Install poetry
RUN pip install poetry==2.1.4

# Set working directory
WORKDIR "${LAMBDA_TASK_ROOT}"

# Copy poetry files
COPY pyproject.toml poetry.lock ./

# Configure poetry and install dependencies
RUN poetry config virtualenvs.create false && \
    poetry install --only=main --no-root

# Copy function code
COPY . ./

# Set the CMD to your handler
CMD ["index.handler"]
