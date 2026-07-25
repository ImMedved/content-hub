# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
WORKDIR /app

COPY backend/package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --cache /root/.npm --prefer-offline

COPY backend/src ./src
COPY backend/uploads ./uploads
COPY backend/.env.production.example ./.env.production.example
COPY database ./database

CMD ["node", "src/server.js"]
