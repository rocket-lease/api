#!/bin/sh
export DATABASE_URL="postgresql://postgres:postgres@localhost:5435/rocket_lease_test"
export DIRECT_URL="postgresql://postgres:postgres@localhost:5435/rocket_lease_test"

# Opt-in explícito que cleanDb() exige antes de hacer DELETEs.
# Ver test/cucumber/support/world.ts assertSafeToCleanDb().
export CLEANDB_ALLOW=1

EXTRA_ARGS="$@"

cleanup() {
    echo "Deteniendo base de datos de test..."
    docker compose -f docker-compose.test.yml down --remove-orphans >/dev/null 2>&1 || true
}

trap cleanup EXIT

echo "Limpiando estado previo de la base de datos de test..."
docker compose -f docker-compose.test.yml down --remove-orphans >/dev/null 2>&1 || true

echo "Iniciando base de datos de test..."
docker compose -f docker-compose.test.yml up -d --wait || exit 1

echo "Aplicando migraciones..."
pnpm exec prisma migrate deploy || exit 1

echo "Ejecutando tests Cucumber..."
# Bypass `pnpm exec` para no contaminarlo con `--import tsx`, que rompe el loader interno de pnpm.
NODE_OPTIONS='--import tsx' ./node_modules/.bin/cucumber-js --tags "not @ignore" $EXTRA_ARGS
