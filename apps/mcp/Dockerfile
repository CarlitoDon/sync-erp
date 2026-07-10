FROM node:20-alpine
WORKDIR /app

# Install MCP app deps standalone. Build with the repo root as context:
# docker build -f apps/mcp/Dockerfile .
COPY apps/mcp/package*.json ./
RUN npm install

COPY apps/mcp/tsconfig.json ./
COPY apps/mcp/src/ ./src/

ENV NODE_ENV=production
ENV MCP_PORT=3005

EXPOSE 3005
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3005/health || exit 1

CMD ["npx", "tsx", "src/index.ts"]
