FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY . .
RUN mkdir -p /data && chown node:node /data
USER node
ENV ENGINE_HOST=0.0.0.0 ENGINE_DATA_DIR=/data PORT=4318
EXPOSE 4318
CMD ["node", "src/server.mjs"]
