FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

ENV DATA_DIR=/app/data
ENV PORT=3000
EXPOSE 3000

CMD ["node", "src/server.js"]
