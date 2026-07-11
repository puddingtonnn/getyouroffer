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
# (опционально DEEPSEEK_BASE_URL — другой OpenAI-совместимый эндпоинт)
# для /api/users/* задайте JWT_SECRET (напр. `openssl rand -hex 32`)
make db-up            # поднять Postgres (нужен запущенный Docker Desktop)
make db-migrate       # применить миграции
make back             # терминал 1: Go API на :8090
make front            # терминал 2: Vite dev на :5173
```

Откройте http://localhost:5173 — форма «резюме + вакансия» на месте.

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

- **Подгонка резюме** (`POST /api/tailor`): загрузка PDF-резюме + текст
  вакансии → подогнанное резюме, анализ соответствия (совпадения и пробелы),
  ключевые слова, черновик сопроводительного письма (DeepSeek).
- Регистрация/логин и профиль (`/api/users/*`, JWT) — требует Postgres и
  `JWT_SECRET` (без секрета роуты отключены).
- **Трекер откликов** (`/api/vacancies`, `/api/resumes`): статусы
  черновик → отправлено → ответ → отказ / оффер.
- Health-эндпоинт `GET /api/health` (статус БД).

## Фронтенд

SPA в дизайн-системе «Афиша» (палитра «Электрик»; шрифты Oswald / Onest /
Ubuntu Mono / Caveat, self-hosted через `@fontsource`):

- `/` — лендинг «рабочий стол соискателя» (файлы можно таскать мышью);
- `/login`, `/register` — вход и регистрация (JWT в localStorage);
- `/app/new` — новый отклик: вакансия + PDF-резюме → подгонка;
- `/app/vacancies/:id` — дашборд результата: скор, совпадения, пробелы,
  ключевые слова, резюме 2.0, сопроводительное письмо;
- `/app/tracker` — трекер: реестр откликов со сменой статуса и воронка поиска.
