FROM node:22-alpine

RUN npm install -g pnpm@11.0.8

ENV CI=true

WORKDIR /workspace

# Copy only what's needed for contracts (no node_modules)
COPY contracts/src/ ./contracts/src/
COPY contracts/package.json contracts/pnpm-lock.yaml contracts/tsconfig.json ./contracts/
WORKDIR /workspace/contracts
RUN pnpm install --frozen-lockfile
RUN pnpm build

# Copy only what's needed for api (no node_modules, no dist)
WORKDIR /workspace/api
COPY api/package.json api/pnpm-lock.yaml api/.npmrc api/nest-cli.json api/tsconfig.json api/tsconfig.build.json ./
RUN pnpm install --frozen-lockfile
COPY api/src/ ./src/
COPY api/prisma/ ./prisma/
RUN pnpm exec prisma generate
RUN pnpm build

EXPOSE 3000

CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main"]
