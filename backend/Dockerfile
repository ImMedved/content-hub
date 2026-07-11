FROM node:22-alpine AS base
WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/src ./src
COPY backend/uploads ./uploads
COPY backend/.env.production.example ./.env.production.example
COPY database ./database

CMD ["node", "src/server.js"]
