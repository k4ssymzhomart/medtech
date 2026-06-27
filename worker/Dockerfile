# MedServicePrice.kz worker — Playwright Python base (per architecture §9),
# so Phase 2 can add headless fetching without changing the base image.
FROM mcr.microsoft.com/playwright/python:v1.49.0-jammy

WORKDIR /app

# Install dependencies first for layer caching.
COPY pyproject.toml ./
RUN pip install --no-cache-dir .

# App code.
COPY app ./app

# The worker only needs OUTBOUND access to Supabase. No inbound ports.
CMD ["python", "-m", "app.main"]
