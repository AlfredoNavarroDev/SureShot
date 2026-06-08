# SureShot

World Cup prediction REST API — NestJS + Prisma + PostgreSQL.

## Running Locally (Development)

```bash
cp .env.example .env  # fill real values
docker compose up
```

App: http://localhost:3000/api/v1/health
Swagger: http://localhost:3000/api/docs

## Running in Production (with load balancing)

```bash
cp .env.example .env  # fill production values
docker compose -f docker-compose.prod.yml up --build --scale app=3 -d
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
```

Nginx routes round-robin across 3 app replicas on port 80.

## Stress Testing

```bash
brew install k6
docker compose -f docker-compose.prod.yml up --scale app=3 -d
k6 run k6/stress-test.js
```
