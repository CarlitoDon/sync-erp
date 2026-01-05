# Railway Dockerfile for sync-erp API
# Uses Node.js 22 Alpine (includes 22.12+) for Prisma 7.1 compatibility

FROM node:22-alpine AS builder

# Build args for Prisma generate
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

WORKDIR /app

# Install dependencies needed for native modules
RUN apk add --no-cache python3 make g++ openssl

# Copy all source code
COPY . .

# Install all dependencies
RUN npm ci --include=dev

# Generate Prisma client with patch script
WORKDIR /app/packages/database
RUN npx prisma generate && node ../scripts/patch-zod-types.mjs
WORKDIR /app

# Build workspace packages (needed because node_modules resolution points to dist/)
RUN npm run build --workspace=@sync-erp/database
RUN npm run build --workspace=@sync-erp/shared

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

# Install openssl for Prisma runtime
RUN apk add --no-cache openssl

# Install tsx and typescript globally to run TS in production
RUN npm install -g tsx typescript

# Copy everything from builder (node_modules included, but we might want to prune later?)
# For simplicity and speed in fixing this crash, let's keep devDependencies (needed for tsx resolution sometimes)
# Optimization can be done later once stable.
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/packages/database ./packages/database
COPY --from=builder /app/packages/shared ./packages/shared

# Expose port
EXPOSE 3001

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

# Start with migration and then app
CMD sh -c "cd packages/database && npx prisma migrate deploy && cd ../.. && tsx apps/api/src/index.ts"
