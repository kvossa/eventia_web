# syntax=docker/dockerfile:1

# ---------- deps: install the full workspace (needed to build shared + backend) ----------
FROM node:26-bookworm-slim AS deps
ARG PNPM_VERSION=10.33.4
RUN npm install -g "pnpm@${PNPM_VERSION}"
WORKDIR /repo

# manifests first so the install layer is cached independently of source edits
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN pnpm install --frozen-lockfile

# ---------- build: compile shared, then backend ----------
FROM deps AS build
WORKDIR /repo
COPY shared/ shared/
COPY backend/ backend/
RUN pnpm build:shared && pnpm -C backend build

# ---------- deploy: produce a portable prod-only tree for backend ----------
FROM deps AS deploy
WORKDIR /repo
COPY shared/ shared/
COPY backend/ backend/
# shared must be compiled here too: pnpm deploy packs @eventia/shared by
# reference, and the context no longer supplies a host-built shared/dist.
RUN pnpm build:shared && pnpm --filter backend deploy --prod --legacy /out

# ---------- runtime ----------
FROM node:26-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends dumb-init \
 && rm -rf /var/lib/apt/lists/*

COPY --from=deploy /out ./
COPY --from=build /repo/backend/dist ./dist

# uploads/ is a volume in production; create it so the app can write as a non-root user
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]