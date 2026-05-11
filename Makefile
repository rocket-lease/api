include .env.test
export DATABASE_URL
export DIRECT_URL

.PHONY: run test tests

run:
	docker compose -f docker-compose.yml up --build

ifeq ($(OS),Windows_NT)
test:
	powershell -ExecutionPolicy Bypass -File scripts/test-cucumber.ps1
else
test:
	sh scripts/test-cucumber.sh
endif

tests:
	pnpm test:unit && pnpm test:cucumber
