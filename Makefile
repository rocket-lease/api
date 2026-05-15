.PHONY: run run-local db stop test tests check-siblings

# Default: api on host against the prod DB (Supabase via .env.local).
# Quickest path to validate code against real data and Supabase auth.
run: check-siblings
	pnpm start:dev

# Everything in docker: api container + local Postgres + ../contracts bind-mount.
# Use this when you don't want Node/pnpm installed locally, or for onboarding.
run-local: check-siblings
	docker compose --profile full up --build

# Just bring up Postgres locally (ad-hoc psql sessions, paired tests, etc.).
db:
	docker compose --profile db up -d db

stop:
	docker compose --profile full down

check-siblings:
	@test -d ../contracts || (echo "" && \
	  echo "  Falta ../contracts. Cloná rocket-lease/contracts al lado de api/." && \
	  echo "  Detalles: api/docs/adr/0007-contracts-as-source.md" && \
	  echo "" && exit 1)

ifeq ($(OS),Windows_NT)
test:
	powershell -ExecutionPolicy Bypass -File scripts/test-cucumber.ps1
else
test:
	sh scripts/test-cucumber.sh
endif

tests: db
	@set -a; . ./.env.test; set +a; pnpm test:unit && pnpm test:cucumber
