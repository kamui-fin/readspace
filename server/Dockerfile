# 1. Use an official Python runtime as a parent image
FROM python:3.12-slim AS base

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV POETRY_VERSION=1.7.1
ENV POETRY_HOME=/opt/poetry
ENV POETRY_VENV=/opt/poetry/.venv
ENV POETRY_CACHE_DIR=/opt/.cache

# Add poetry to path
ENV PATH="$POETRY_HOME/bin:$PATH"

# Install system dependencies
RUN apt-get update \
    && apt-get install --no-install-recommends -y \
        curl \
        build-essential \
    && apt-get install -y \
        wget \
        libmagic-dev \
        poppler-utils \
        tesseract-ocr \
        pandoc \
        libglib2.0-0 \
        libgl1 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN curl -sSL https://install.python-poetry.org | python3 -

# Set working directory
WORKDIR /app

# Copy dependency definition files
COPY pyproject.toml poetry.lock ./

# Install production dependencies
# --no-root avoids installing the project itself editable, which is good for prod
# --no-dev skips development dependencies
RUN poetry install --no-root --no-dev

# Copy the rest of the application code
# Ensure the source paths match your structure (app/, prompts/)
COPY ./app ./app
COPY ./prompts ./prompts

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application using fastapi-cli
# Note: This implicitly uses uvicorn/hypercorn. Ensure fastapi[all] or uvicorn is installed.
CMD ["poetry", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3000"]
