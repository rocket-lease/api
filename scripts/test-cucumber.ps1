$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5435/rocket_lease_test"
$env:DIRECT_URL = "postgresql://postgres:postgres@localhost:5435/rocket_lease_test"

try {
    Write-Host "Limpiando estado previo de la base de datos de test..."
    docker compose -f docker-compose.test.yml down --remove-orphans | Out-Null

    Write-Host "Iniciando base de datos de test..."
    docker compose -f docker-compose.test.yml up -d --wait
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    $exitCode = 0
    Write-Host "Aplicando migraciones..."
    pnpm exec prisma migrate deploy
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    Write-Host "Ejecutando tests Cucumber..."
    pnpm exec cucumber-js
    $exitCode = $LASTEXITCODE
} finally {
    Write-Host "Deteniendo base de datos de test..."
    docker compose -f docker-compose.test.yml down --remove-orphans | Out-Null
}

exit $exitCode
