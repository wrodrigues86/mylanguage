FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci

COPY backend ./backend

ENV NODE_ENV=production \
    PORT=3001 \
    DATABASE_PATH=/app/data/mylingua.db

RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3001
VOLUME ["/app/data"]

CMD ["npm", "start", "--workspace", "backend"]
