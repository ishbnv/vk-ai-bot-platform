FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/backend/package.json apps/backend/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json

RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS runtime
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/backend/node_modules ./apps/backend/node_modules
# shared-types — чистый TS-пакет без своих deps, отдельного node_modules у него нет.

COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/backend ./apps/backend
COPY packages/shared-types ./packages/shared-types

WORKDIR /repo/apps/backend
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "start"]
