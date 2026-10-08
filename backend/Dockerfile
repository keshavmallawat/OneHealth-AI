# OneHealth AI - API server.
# Build:  docker build -t onehealth-api ./backend
# The entrypoint applies database migrations, then starts the server.
FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app

# OpenSSL is needed by the Prisma client runtime.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# devDependencies are required to compile TypeScript; NODE_ENV is set after install.
RUN NODE_ENV=development npm ci --no-audit --no-fund

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json tsconfig.seed.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build

# Uploaded documents live here when STORAGE_DRIVER=local. Mount a volume on it.
RUN mkdir -p /app/storage && chown -R node:node /app
USER node
EXPOSE 3001

CMD ["sh", "-c", "node scripts/apply-migrations.js && node dist/index.js"]
