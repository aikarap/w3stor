# === Stage 1: Install dependencies ===
FROM oven/bun:1.2.12-alpine AS deps
WORKDIR /app

# Copy package files for all workspaces
COPY package.json bun.lock ./
COPY packages/api/package.json packages/api/package.json
COPY packages/workers/package.json packages/workers/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/modules/package.json packages/modules/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/sdk/package.json packages/sdk/package.json
COPY packages/cli/package.json packages/cli/package.json

# Install all dependencies (workspace: links resolve at runtime with Bun)
RUN bun install

# === Stage 2: Production image ===
FROM oven/bun:1.2.12-alpine AS runner
WORKDIR /app

# Copy everything from deps (includes node_modules + workspace symlinks)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/bun.lock ./bun.lock

# Copy full source (Bun runs TypeScript directly — no build step needed)
COPY packages/ packages/

# Default to API — override with docker-compose command
ENV PORT=4000
EXPOSE 4000

CMD ["bun", "run", "packages/api/src/index.ts"]
