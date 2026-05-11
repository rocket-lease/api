#!/bin/sh
export DATABASE_URL="postgresql://postgres:postgres@localhost:5435/rocket_lease_test"
export DIRECT_URL="postgresql://postgres:postgres@localhost:5435/rocket_lease_test"

echo "Iniciando base de datos de test..."
docker compose -f docker-compose.test.yml up -d --wait || exit 1

cleanup() {
    echo "Deteniendo base de datos de test..."
    docker compose -f docker-compose.test.yml down
}
trap cleanup EXIT

echo "Aplicando migraciones..."
pnpm exec prisma migrate deploy || exit 1

echo "Ejecutando tests Cucumber..."
pnpm exec cucumber-js
