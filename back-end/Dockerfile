# ── Stage 1: install deps (incl. devDependencies) + generate Prisma client ──
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate

# ── Stage 2: production image — prod deps + generated client only ──
FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
COPY src ./src

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "src/index.js"]
