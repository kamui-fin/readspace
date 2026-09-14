# Use an official Python runtime as a parent image
FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Install system dependencies including CA certificates
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements file
COPY requirements.txt .

# gitignore-parser ships no wheel, so pip builds it from source. By default that
# spins up an isolated build env and re-fetches setuptools/wheel from PyPI even
# though they're already installed below — an extra network round trip that has
# caused self-hosted builds to fail on flaky/restricted DNS. Install the build
# tools first and build it with --no-build-isolation to skip that fetch.
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir --no-build-isolation gitignore-parser==0.1.13

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the alembic configuration first
COPY alembic.ini .

# Copy the application code
COPY ./alembic ./alembic
COPY ./app ./app
COPY ./scripts ./scripts

# Expose the port the app runs on
EXPOSE 8008

# Command to run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8008"]
