# syntax=docker/dockerfile:1

# ---------- deps: full workspace install ----------
FROM node:26-bookworm-slim AS deps
ARG PNPM_VERSION=10.33.4
RUN npm install -g "pnpm@${PNPM_VERSION}"
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN pnpm install --frozen-lockfile

# ---------- build: shared, then Angular production bundle ----------
FROM deps AS build
WORKDIR /repo
COPY shared/ shared/
COPY frontend/ frontend/
RUN pnpm build:shared && pnpm -C frontend build

# ---------- runtime: static files only; Caddy is the edge and serves these ----------
FROM nginx:1.29-alpine AS runtime
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /repo/frontend/dist/frontend/browser/ /usr/share/nginx/html/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]