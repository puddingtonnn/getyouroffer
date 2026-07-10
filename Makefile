-include .env
export

.PHONY: setup db-up db-down db-logs db-migrate back front fmt vet test

setup: ## первый запуск: создать .env, поставить зависимости
	@test -f .env || cp .env.example .env
	cd backend && go mod download
	cd frontend && npm install

db-up: ## поднять postgres и дождаться healthcheck
	docker compose up -d --wait db

db-down: ## остановить контейнеры (данные в volume сохраняются)
	docker compose down

db-logs:
	docker compose logs -f db

db-migrate: ## применить все sql из backend/migrations по порядку
	cat backend/migrations/*.sql | docker compose exec -T db \
		psql -U $(POSTGRES_USER) -d $(POSTGRES_DB) -v ON_ERROR_STOP=1

back: ## запустить Go API на :$(PORT)
	cd backend && go run ./cmd/server

front: ## запустить Vite dev-сервер на :5173
	cd frontend && npm run dev

fmt:
	cd backend && gofmt -w .

vet:
	cd backend && go vet ./...

test:
	cd backend && go test ./...
