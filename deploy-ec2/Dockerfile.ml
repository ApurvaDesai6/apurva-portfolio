FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ curl && rm -rf /var/lib/apt/lists/*

COPY mini-services/ml-service/package.json ./
RUN pip install --no-cache-dir \
    fastapi uvicorn pydantic numpy pandas \
    prisma google-cloud-bigquery earthengine-api

COPY mini-services/ml-service/ ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN python -m prisma generate --schema=./prisma/schema.prisma

ENV PORT=8000
ENV DATABASE_URL=file:/data/dev.db

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "index:app", "--host", "0.0.0.0", "--port", "8000"]
