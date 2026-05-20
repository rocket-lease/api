# Production image for the api service.
# Build context MUST be the parent directory containing both `api/` and `contracts/`.
# CI sets this up via the infra composite action `checkout-with-contracts`.
# See infra/docs/adr/0007-contracts-as-source.md.

# ---------- Build stage ----------
FROM node:22-alpine AS build

RUN npm install -g pnpm@11.0.8
ENV CI=true

WORKDIR /workspace

# Copy both repos as siblings, mirroring the dev filesystem layout.
COPY contracts ./contracts
COPY api ./api

WORKDIR /workspace/api

# Install contracts peer deps so tsc can resolve zod from contracts source.
WORKDIR /workspace/contracts
RUN pnpm install --frozen-lockfile --ignore-scripts

WORKDIR /workspace/api
# preinstall hook checks the sibling — it's present here.
RUN pnpm install --frozen-lockfile --ignore-scripts

# Generate Prisma client + bundle the app with webpack.
# `nest build --webpack` inlines contracts source into dist/main.js so the
# runtime layer needs no awareness of @rocket-lease/contracts.
RUN pnpm exec prisma generate
RUN pnpm build

# Prune to runtime deps only. Contracts is `link:../contracts` so pnpm leaves
# the symlink; we drop the entire contracts copy from the runtime layer anyway.
RUN pnpm prune --prod --ignore-scripts

# ---------- Runtime stage ----------
FROM node:22-alpine

RUN npm install -g pnpm@11.0.8
WORKDIR /app

COPY --from=build /workspace/api/dist ./dist
COPY --from=build /workspace/api/node_modules ./node_modules
COPY --from=build /workspace/api/package.json ./
COPY --from=build /workspace/api/prisma ./prisma

EXPOSE 8080

CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main"]
