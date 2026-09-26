FROM node:20-alpine AS builder
WORKDIR /repo

ENV NODE_ENV=development
ENV NO_DTS=true
ARG VITE_SYNC_ERP_API_URL=/api/trpc
ENV VITE_SYNC_ERP_API_URL=${VITE_SYNC_ERP_API_URL}

COPY package*.json ./
COPY turbo.json tsconfig.json tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/eslint-plugin/package.json ./packages/eslint-plugin/package.json

RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts --include=dev

COPY packages/database/src ./packages/database/src
COPY packages/database/prisma ./packages/database/prisma
COPY packages/database/prisma.config.ts packages/database/tsconfig.json packages/database/tsup.config.ts ./packages/database/
COPY packages/scripts/patch-zod-types.mjs ./packages/scripts/patch-zod-types.mjs
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json packages/shared/tsup.config.ts ./packages/shared/
COPY apps/web ./apps/web

RUN npx turbo build --filter=@sync-erp/web

FROM nginx:alpine AS runner
COPY --from=builder /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
