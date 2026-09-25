FROM node:20-alpine AS builder
WORKDIR /repo

ENV NODE_ENV=development
ENV NO_DTS=true

COPY package*.json ./
COPY turbo.json tsconfig.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/bot/package.json ./apps/bot/package.json
COPY apps/mcp/package.json ./apps/mcp/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/eslint-plugin/package.json ./packages/eslint-plugin/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts --include=dev

COPY apps/mcp/src ./apps/mcp/src
COPY apps/mcp/tsconfig.json ./apps/mcp/
COPY packages/database/src ./packages/database/src
COPY packages/database/prisma ./packages/database/prisma
COPY packages/database/prisma.config.ts packages/database/tsconfig.json packages/database/tsup.config.ts ./packages/database/
COPY packages/scripts/patch-zod-types.mjs ./packages/scripts/patch-zod-types.mjs
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json packages/shared/tsup.config.ts ./packages/shared/

RUN npx turbo build --filter=@sync-erp/mcp

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV MCP_PORT=3005

COPY --from=builder /repo/apps/mcp/dist ./apps/mcp/dist
COPY --from=builder /repo/apps/mcp/package.json ./apps/mcp/package.json
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/packages/database/dist ./packages/database/dist
COPY --from=builder /repo/packages/database/package.json ./packages/database/package.json
COPY --from=builder /repo/packages/shared/dist ./packages/shared/dist
COPY --from=builder /repo/packages/shared/package.json ./packages/shared/package.json

EXPOSE 3005

RUN apk add --no-cache wget

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3005/health || exit 1

CMD ["node", "apps/mcp/dist/index.js"]

