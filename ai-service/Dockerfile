# syntax=docker/dockerfile:1
FROM python:3.12-slim
WORKDIR /srv
COPY ai-service/pyproject.toml .
COPY ai-service/app ./app
RUN pip install --no-cache-dir .
# Same reason as backend/Dockerfile: ECS Fargate can't bind-mount data/ from a
# host the way local docker-compose does, so it has to be baked into the
# image. Build with the repo root as context:
#   docker build -f ai-service/Dockerfile -t yojana-ai-service .
COPY data /data
EXPOSE 8000
CMD ["uvicorn", "app.api:app", "--host", "0.0.0.0", "--port", "8000"]
