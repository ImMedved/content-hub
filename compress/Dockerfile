# syntax=docker/dockerfile:1.7

FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache ffmpeg tini vips

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --cache /root/.npm --prefer-offline

COPY src ./src

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "start"]
