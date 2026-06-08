FROM node:22-alpine AS base
RUN corepack enable pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
RUN pnpm install --no-frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/server/node_modules ./packages/server/node_modules
COPY package.json pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server
RUN pnpm --filter @magellanwars/shared build
RUN pnpm --filter @magellanwars/server db:generate
RUN pnpm --filter @magellanwars/server build

FROM node:22-alpine AS runner
WORKDIR /app
RUN corepack enable pnpm
COPY --from=builder /app/packages/server/dist ./dist
COPY --from=builder /app/packages/server/node_modules ./node_modules
COPY --from=builder /app/packages/server/prisma ./prisma
RUN ./node_modules/.bin/prisma generate
USER node
EXPOSE 3000
CMD ["sh", "-c", "node_modules/.bin/prisma db push --accept-data-loss && node dist/index.js"]
