# VK AI Bot Platform

> Multi-community AI chatbot platform для ВК-сообществ в нише микрозаймов и аффилейт-маркетинга.
> Sales-oriented диалог-флоу: бот квалифицирует пользователя, отправляет витрину МФО с UTM-меткой, отвечает пачками подобранных офферов, поднимает диалог напоминаниями если пользователь молчит.

**Stack:** TypeScript · Fastify 5 · React 19 · Mantine v8 · PostgreSQL 16 · Redis 7 · BullMQ · OpenRouter · Docker Compose · GitHub Actions

---

## Что умеет

### Диалоговый движок
- VK Callback API receiver с двухслойной дедупликацией (`vk_events_processed` в PG + Redis SETNX в worker'е) — защита от ретраев VK и BullMQ
- Token-aware контекстное окно (gpt-tokenizer) с настраиваемой длиной per-community
- AES-256-GCM шифрование VK access-токенов в БД
- Модель фиксируется на первом сообщении диалога (`dialog.bucket_model`) и не пересчитывается даже при смене настроек
- Полная история диалога с per-message метриками: токены in/out, стоимость USD, latency, флаг отправленной ссылки

### Lead-gen workflow
- Плейсхолдер `{{LINK_SHOWCASE}}` — бот один раз за диалог вставляет ссылку на витрину МФО. UTM-параметры:
  - `utm_source` — задаётся в админке per-витрина
  - `utm_campaign` = `ref` из VK Ads (`message.ref` в первом event'е)
  - `utm_content` = `ref_source` из VK Ads
  - `utm_term` = `vk_user_id`
- Плейсхолдер `{{NEXT_PACK}}` — последовательные пачки партнёрских офферов, по одной на каждое последующее сообщение пользователя. 4 дефолтные пачки (priority-листы из боевой n8n-системы) автоматически создаются при подключении сообщества. Контент пачки — сырой текст с плейсхолдерами `{utm_source}`, `{batch}`, `{ref}`, `{ref_source}`, `{vk_user_id}` — worker подставляет на лету
- Переключатель «прямые ссылки vs редирект» per-community: либо через `/r/:linkId` (фиксирует `converted_at`), либо сразу полный URL с UTM (короче, но без трекинга кликов)
- Конверсия фиксируется first-click logic: первое срабатывание `/r/:linkId` пишет `converted_at` + `conversion_link_id`, последующие клики не перезаписывают

### Напоминания (nudges)
- BullMQ delayed-job планируется после каждого ответа бота, отменяется при ответе пользователя
- Work-hours gate: если сейчас вне рабочих часов community (МСК) — job переносится на начало ближайшего рабочего часа
- Максимум 2 nudge с эскалацией delay × 2, настраивается `nudge_delay_minutes`
- Пустой ответ LLM и VK error 100 на send проглатываются без throw — это валидационные ошибки, retry даст тот же результат и продублирует записи в БД

### Cron-агенты (BullMQ repeatable)
- Каждый час: dialog-completion sweep — диалоги без активности дольше `completion_silence_hours` переводятся в `converted` (если был клик) или `abandoned`
- Каждые 6 часов: refresh цен моделей с OpenRouter
- Раз в сутки: cleanup `vk_events_processed` старше 7 дней

### Админ-панель
- JWT auth для single super-admin (bcrypt-хэш в env)
- Подключение ВК-сообщества с программной регистрацией Callback Server (`groups.addCallbackServer` + `setCallbackSettings`) и авто-сидингом 4 дефолтных пачек офферов
- Промпт-редактор с версионированием и live-превью через `POST /api/prompts/test` (отдельный endpoint, не сохраняется в БД)
- Витрины (landing-ссылки) — CRUD с подсветкой автоматических UTM
- Пачки офферов — CRUD с monospace-предпросмотром контента
- Список диалогов с фильтром по статусу + Drawer с полной перепиской и per-message метриками
- Карточки метрик: started / converted / active / nudged / abandoned + tokens / cost / conversion rate, фильтр по периоду

---

## Архитектура

```
ВК Callback API
       │ POST events
       ▼
Fastify Webhook Receiver (/webhooks/vk)
       • zod-валидация payload
       • verify community.vk_callback_secret
       • dedupe по event_id (PG vk_events_processed)
       • enqueue → BullMQ
       ▼
Redis 7 + BullMQ (5 очередей)
       • dialog-processing
       • nudge-followup (delayed)
       • dialog-completion (cron 1h)
       • prices-refresh    (cron 6h)
       • vk-events-cleanup (cron 24h)
       ▼
Dialog Worker (in-process, concurrency 5)
       1. Redis SETNX по event_id — защита от BullMQ-retry дублей
       2. find/create dialog + сохранить ref/ref_source при первом сообщении
       3. сохранить user message
       4. cancel pending nudge
       5. token-aware context build (последние N сообщений с обрезанием по token limit)
       6. inject "пачек отправлено N из M" meta в system prompt
       7. OpenRouter chat (single model per dialog)
       8. replace {{LINK_SHOWCASE}} — либо через redirect URL, либо сразу с UTM
       9. replace {{NEXT_PACK}} — substitute placeholders + advance packs_sent_count
      10. save assistant msg + update dialog totals
      11. messages.send в ВК (swallow VK code 100, skip пустой текст)
      12. schedule next nudge (под try/catch — ошибки не валят job)
       ▼
PostgreSQL 16 (Drizzle ORM)
       communities, prompts, landing_links, offer_packs,
       dialogs, messages, metrics_hourly, model_prices,
       vk_events_processed
```

---

## Структура

```
vk-ai-bot-platform/
├── apps/
│   ├── backend/                Fastify + Drizzle + BullMQ workers
│   │   ├── src/
│   │   │   ├── api/            HTTP routes (auth, communities, prompts, landing-links, offer-packs, dialogs, metrics, models, redirect)
│   │   │   ├── webhooks/       VK Callback receiver
│   │   │   ├── workers/        5 BullMQ workers
│   │   │   ├── services/       domain logic (dialog, openrouter, vk, community, prompts)
│   │   │   ├── db/             schema, migrations runner, client
│   │   │   ├── plugins/        fastify plugins (auth)
│   │   │   ├── queues/         BullMQ queue definitions + repeatable bootstrap
│   │   │   └── lib/            crypto, redis, logger
│   │   └── drizzle/            SQL migrations (drizzle-kit generated)
│   └── frontend/               React 19 + Vite + Mantine v8
│       └── src/
│           ├── app/            store (RTK + RTK Query), router, app-shell, protected-route
│           ├── pages/          login, communities, community-details, dialogs, metrics
│           ├── features/       connect-community, edit-community-settings, prompt-editor,
│           │                   manage-landing-links, manage-offer-packs, dialog-drawer
│           ├── entities/       RTK Query API slices per ресурс
│           └── shared/         lib (token storage), ui
├── packages/
│   └── shared-types/           DTO shared между бэком и фронтом
├── deploy/
│   ├── deploy.sh               bash deploy helper (prod|dev), uses DEPLOY_SKIP_PULL=1 от CI
│   └── nginx/                  vk.24finkit.ru.conf + vk.dev.24finkit.ru.conf
├── .github/workflows/
│   ├── ci.yml                  lint + typecheck + test + frontend build, reusable
│   └── deploy.yml              auto: main → prod, dev → dev через SSH (appleboy/ssh-action)
├── docker-compose.yml          local dev: postgres + redis с пробросом портов
├── docker-compose.deploy.yml   VPS: параметризуется через .env (COMPOSE_PROJECT_NAME, BACKEND_HOST_PORT)
└── .env.{example,prod.example,dev.example}
```

---

## Локальная разработка

Требования: **Node 22+**, **pnpm 9+**, **Docker**

```bash
cp .env.example .env
# заполни обязательные:
#   OPENROUTER_API_KEY=sk-or-v1-...
#   ENCRYPTION_KEY=...          # openssl rand -hex 32
#   JWT_SECRET=...               # любая длинная случайная строка ≥ 32 символов
#   ADMIN_PASSWORD_HASH=...      # cd apps/backend && node -e "console.log(require('bcryptjs').hashSync('PASS', 10))"

pnpm install
pnpm infra:up               # postgres + redis в docker
pnpm db:migrate             # применить миграции
pnpm dev                    # бэк :3000, фронт :5173 в параллель
```

Открой `http://localhost:5173`, логин — `admin` + пароль для которого сгенерил hash.

### Полезные команды

```bash
pnpm dev:backend             # только бэк
pnpm dev:frontend            # только фронт
pnpm db:generate             # сгенерить миграцию из изменений schema.ts
pnpm db:studio               # web UI для базы (drizzle-kit)
pnpm lint
pnpm typecheck
pnpm test                    # vitest на всём workspace
pnpm infra:down              # остановить локальную инфру
```

---

## Production deploy

Один VPS, два изолированных стэка (prod + dev) на разных поддоменах через **один параметризованный** compose-файл.

| Окружение | URL                          | Backend port | env-файл    |
|-----------|------------------------------|-------------:|-------------|
| prod      | `https://vk.24finkit.ru`     | 3032         | `.env.prod` |
| dev       | `https://vk.dev.24finkit.ru` | 3042         | `.env.dev`  |

Изоляция стэков через `COMPOSE_PROJECT_NAME` в env — отдельные docker volumes (`vk-ai-bot-prod_postgres-data` ≠ `vk-ai-bot-dev_postgres-data`) и сети, оба могут крутиться на одном хосте.

### Вариант A — автомат через GitHub Actions

```bash
git push origin main         # → CI + Deploy на prod
git push origin dev          # → CI + Deploy на dev
```

Workflow: lint + typecheck + vitest + frontend build → SSH на VPS под deploy-юзера → `git fetch + reset --hard origin/<branch>` → `bash deploy/deploy.sh <env>`. Concurrency-группа на окружение не даёт двум деплоям пересечься.

`workflow_dispatch` в GitHub UI — для ручного отката (выкатывает любой коммит на любую среду).

### Вариант B — вручную с сервера

```bash
cd /opt/vk-ai-bot-platform           # prod
sudo -u deploy bash deploy/deploy.sh prod

cd /opt/vk-ai-bot-platform-dev        # dev
sudo -u deploy bash deploy/deploy.sh dev
```

Скрипт: `git pull` → `pnpm install` → `pnpm build` (фронт) → `rsync` фронта в `/var/www/...` → `docker compose up -d --build` → `db:migrate` внутри backend-контейнера.

---

## Производительность

- Один VPS (2 vCPU / 4 GB RAM) тянет ~8к диалогов/день, ~10 одновременных в пик
- Ответ webhook'а в пределах 10 секунд (требование VK) — только enqueue, никакой LLM-работы в эндпоинте
- Средняя стоимость диалога: ~$0.005–0.01 в зависимости от модели и длины контекста
- p95 latency LLM-ответа: 2–6с (зависит от модели через OpenRouter)
- BullMQ delayed-job для nudge с jobId-based отменой — линейная сложность переплана при ответе пользователя

---

## Тесты

Vitest на critical pure functions:
- AES-256-GCM round-trip (encrypt → decrypt → equals)
- VK webhook zod parsing (confirmation / message_new / malformed)
- Landing URL UTM building с разными комбинациями ref
- Placeholder extraction / replacement / redirect URL
- Work-hours window calculation (внутри/до/после/24×7/инвертированный)
- OpenRouter cost calculation (per-token цены)

30 тестов суммарно. Integration runs против реального VK-сообщества + OpenRouter ключа.

---

## Лицензия

Проект GIDFINANCE. Not open-source.
