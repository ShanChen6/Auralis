# syntax=docker/dockerfile:1
# Build từ thư mục gốc monorepo:  docker build -f auralis-api/Dockerfile -t auralis-api .

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

# --- Cài dependency (tận dụng cache layer khi chỉ đổi code) ---
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY auralis-api/package.json auralis-api/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile --filter auralis-api --ignore-scripts

# --- Build ---
FROM deps AS build
COPY auralis-api auralis-api
RUN pnpm --filter auralis-api exec prisma generate \
  && pnpm --filter auralis-api build \
  && pnpm --filter auralis-api deploy --prod --legacy --ignore-scripts /out

# --- Runtime gọn nhẹ ---
FROM node:22-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl tini \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production PORT=4000 LOCAL_MEDIA_DIR=/tmp/media
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /repo/auralis-api/dist ./dist
COPY --from=build --chown=node:node /repo/auralis-api/prisma ./prisma
COPY --from=build --chown=node:node /repo/auralis-api/prisma.config.ts ./prisma.config.ts
COPY --chown=node:node auralis-api/docker-entrypoint.sh ./docker-entrypoint.sh
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--", "sh", "./docker-entrypoint.sh"]
