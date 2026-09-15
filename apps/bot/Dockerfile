# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder
WORKDIR /repo

# Copy manifests first so dependency installation remains cacheable.
COPY package*.json ./
COPY turbo.json tsconfig.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/bot/package.json ./apps/bot/package.json
COPY apps/mcp/package.json ./apps/mcp/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/eslint-plugin/package.json ./packages/eslint-plugin/package.json
COPY packages/shared/package.json ./packages/shared/package.json

# Skip lifecycle scripts until the workspace source and Prisma schema are present.
RUN npm ci --ignore-scripts

# Copy only build inputs; do not bake local env/session files into the image.
COPY apps/api/src ./apps/api/src
COPY apps/mcp/src ./apps/mcp/src
COPY apps/api/tsconfig.json apps/api/tsup.config.ts ./apps/api/
COPY apps/bot/src ./apps/bot/src
COPY apps/bot/tsconfig.json apps/bot/tsup.config.ts ./apps/bot/
COPY packages/database/src ./packages/database/src
COPY packages/database/prisma ./packages/database/prisma
COPY packages/database/prisma.config.ts packages/database/tsconfig.json packages/database/tsup.config.ts ./packages/database/
COPY packages/scripts/patch-zod-types.mjs ./packages/scripts/patch-zod-types.mjs
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json packages/shared/tsup.config.ts ./packages/shared/

# Generate Prisma client before building dependent workspace packages.
RUN cd packages/database && npx prisma generate --generator client
RUN npx turbo build --filter=@sync-erp/bot

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3003

COPY --from=builder /repo/apps/bot/dist ./apps/bot/dist
COPY --from=builder /repo/apps/bot/package.json ./apps/bot/package.json
COPY --from=builder /repo/node_modules ./node_modules
# npm workspaces link these packages from node_modules; copy their built targets too.
COPY --from=builder /repo/packages/database/dist ./packages/database/dist
COPY --from=builder /repo/packages/database/package.json ./packages/database/package.json
COPY --from=builder /repo/packages/shared/dist ./packages/shared/dist
COPY --from=builder /repo/packages/shared/package.json ./packages/shared/package.json

EXPOSE 3003

# node:20-alpine ships without wget; HEALTHCHECK + Coolify probes need it.
RUN apk add --no-cache wget

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3003/health || exit 1

CMD ["node", "apps/bot/dist/index.js"]
