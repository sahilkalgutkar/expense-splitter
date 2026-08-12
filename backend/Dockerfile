FROM node:22-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Applies any pending migrations before starting, so a fresh deploy always has an up-to-date schema.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
