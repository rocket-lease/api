include .env.test
export DATABASE_URL

.PHONY: run test tests

run:
	docker compose -f docker-compose.yml up --build

test:
	powershell -ExecutionPolicy Bypass -File scripts/test-cucumber.ps1

tests:
	pnpm test:unit && pnpm test:cucumber
