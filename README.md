# GetYourOffer

Веб-сервис, который автоматизирует рутину отклика на вакансии: вставляете
вакансию и своё резюме (PDF) — получаете подогнанное под вакансию резюме,
анализ соответствия, черновик сопроводительного письма и запись в трекер
откликов.

Подробный контекст проекта, контракт LLM и конвенции команды — в
[AGENTS.md](AGENTS.md).

## Стек

- Бэкенд: Go 1.26, chi, pgx (Postgres)
- Фронтенд: Vite + React + TypeScript + Tailwind CSS v4
- LLM: DeepSeek API (OpenAI-совместимый)
- БД: Postgres 16 в docker-compose

## Требования

- Go 1.26+
- Docker Desktop (запущенный!)
- Node.js LTS: `brew install node` (или `brew install node@24` — тогда
  добавьте `/opt/homebrew/opt/node@24/bin` в PATH)

## Быстрый старт

```bash
git clone https://github.com/puddingtonnn/getyouroffer.git
cd getyouroffer
make setup            # создаст .env, поставит зависимости
# впишите свой DEEPSEEK_API_KEY в .env
make db-up            # поднять Postgres (нужен запущенный Docker Desktop)
make db-migrate       # применить миграции
make back             # терминал 1: Go API на :8090
make front            # терминал 2: Vite dev на :5173
```

Откройте http://localhost:5173 — плейсхолдер должен показать «API: доступен».

## Make-цели

| Цель | Что делает |
|---|---|
| `make setup` | Первичная настройка: `.env` + зависимости |
| `make db-up` / `db-down` | Поднять/остановить Postgres |
| `make db-migrate` | Применить SQL-миграции из `backend/migrations/` |
| `make back` | Запустить Go API (:8090) |
| `make front` | Запустить Vite dev-сервер (:5173) |
| `make fmt` / `vet` / `test` | gofmt / go vet / go test по бэкенду |

## Функциональность

Пока только окружение: скелеты бэкенда и фронтенда, health-эндпоинт,
Postgres. Фичи появятся по мере разработки — держим этот раздел актуальным.
