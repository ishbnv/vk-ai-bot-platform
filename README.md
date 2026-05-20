# VK AI Bot Platform

> Multi-community platform for managing AI chatbots in VK groups.
> Built for lead generation, sales, and consultations in the microfinance sector.

**Stack:** TypeScript · Fastify · React 19 · Mantine v8 · PostgreSQL · Redis · BullMQ · OpenRouter

## Структура

```
vk-ai-bot-platform/
├── apps/
│   ├── backend/      Fastify + Drizzle + BullMQ workers
│   └── frontend/     React 19 + Vite + Mantine v8
├── packages/
│   └── shared-types/ Общие DTO между фронтом и бэком
├── docker-compose.yml          local dev: postgres + redis (порты на хост)
├── docker-compose.deploy.yml   VPS: pg + redis + backend (prod/dev через .env)
├── deploy/                     nginx-конфиги и deploy.sh
└── .env.example                локальный; для VPS см. .env.prod.example / .env.dev.example
```

## Локальная разработка

Требования: Node 22+, pnpm 9+, Docker.

```bash
cp .env.example .env
pnpm install
pnpm infra:up           # postgres + redis в docker
pnpm db:migrate         # применяет drizzle-миграции
pnpm dev                # параллельно бэк (:3000) и фронт (:5173)
```

## Полезные команды

```bash
pnpm dev:backend        # только бэк
pnpm dev:frontend       # только фронт
pnpm db:generate        # генерация новой миграции из изменений схемы
pnpm lint               # eslint на весь монорепо
pnpm typecheck          # tsc --noEmit во всех пакетах
pnpm test               # vitest
pnpm infra:down         # остановить инфру
```

## Документация

- Полная техническая спека: [`../TECH_SPEC.md`](../TECH_SPEC.md)
- Договорённости и кодстайл: [`../CLAUDE.md`](../CLAUDE.md)
