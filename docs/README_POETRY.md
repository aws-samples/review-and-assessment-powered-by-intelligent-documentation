# Poetry Dependency Management

This document describes how to use Poetry for dependency management in the Python components of the Strands Agent SDK.

## What is Poetry?

Poetry is a modern dependency management and packaging tool for Python that makes package management easier and more consistent. It provides a single command to manage dependencies, build and package projects.

## Installation

To install Poetry, follow the official installation guide at [https://python-poetry.org/docs/#installation](https://python-poetry.org/docs/#installation).

Quick installation for most systems:

```bash
curl -sSL https://install.python-poetry.org | python3 -
```

## Python Components Using Poetry

Poetry has been configured for the following Python components in this project:

1. **Backend Review Item Processor**:
   - Path: `/backend/src/review-workflow/review-item-processor/`

2. **CDK MCP Runtime Component**:
   - Path: `/cdk/lib/constructs/mcp-runtime/python/`

## Usage

### Working with Dependencies

1. **Navigate to the component directory**:

   ```bash
   cd backend/src/review-workflow/review-item-processor/
   # OR
   cd cdk/lib/constructs/mcp-runtime/python/
   ```

2. **Install dependencies**:

   ```bash
   poetry install
   ```

3. **Activate the virtual environment**:

   ```bash
   poetry shell
   ```

### Adding New Dependencies

To add a new dependency:

```bash
poetry add package-name
```

For a specific version:

```bash
poetry add "package-name>=1.0.0"
```

### Updating Dependencies

To update all dependencies:

```bash
poetry update
```

To update a specific dependency:

```bash
poetry update package-name
```

### Working with Local Wheel Files

Both Python components use a local wheel file `run_mcp_servers_with_aws_lambda-0.2.1.post2.dev0+254672e-py3-none-any.whl`. This is automatically handled by Poetry when you run `poetry install`.

If you update the wheel file, run:

```bash
poetry update run-mcp-servers-with-aws-lambda
```

## Converting Between Requirements.txt and Poetry

The project maintains both `requirements.txt` and Poetry configurations for compatibility. If you make changes to one, you should update the other:

### From Poetry to requirements.txt:

```bash
poetry export -f requirements.txt --output requirements.txt
```

### From requirements.txt to Poetry:

```bash
# First, add the requirements from requirements.txt
cat requirements.txt | grep -v "^#" | grep -v "^\s*$" | xargs -n1 poetry add
```

## Troubleshooting

### Local Wheel File Issues

If you encounter issues with the local wheel file:

1. Verify the wheel file exists in the correct location
2. Make sure the path in `pyproject.toml` is correct
3. Try removing the wheel reference and reinstalling:

   ```bash
   poetry remove run-mcp-servers-with-aws-lambda
   poetry add ./run_mcp_servers_with_aws_lambda-0.2.1.post2.dev0+254672e-py3-none-any.whl
   ```

### Virtual Environment Issues

If your virtual environment becomes corrupted:

```bash
# Delete the environment
poetry env remove python
# Create a new one
poetry install
```