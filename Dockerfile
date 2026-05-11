FROM node:22-alpine

RUN npm install -g pnpm@11.0.8

ENV CI=true

WORKDIR /app

COPY package.json pnpm-lock.yaml .npmrc nest-cli.json tsconfig.json tsconfig.build.json ./
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY src/ ./src/
COPY prisma/ ./prisma/
RUN pnpm exec prisma generate
RUN pnpm build

EXPOSE 3000

CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main"]
