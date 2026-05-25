import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core';

import type { TDialogStatus, TMessageRole } from 'shared-types';

type TAbBucket = { model: string; weight: number };
type TAttachment = { type: string; url: string };

// --- communities ---
export const communities = pgTable(
  'communities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    vk_group_id: bigint('vk_group_id', { mode: 'number' }).notNull(),
    vk_access_token_encrypted: text('vk_access_token_encrypted').notNull(),
    vk_callback_secret: text('vk_callback_secret').notNull(),
    vk_callback_confirmation_code: text('vk_callback_confirmation_code').notNull(),
    name: text('name').notNull(),
    is_active: boolean('is_active').notNull().default(true),
    work_hours_start: smallint('work_hours_start').notNull().default(0),
    work_hours_end: smallint('work_hours_end').notNull().default(24),
    nudge_delay_hours: smallint('nudge_delay_hours').notNull().default(3),
    completion_silence_hours: smallint('completion_silence_hours').notNull().default(24),
    forbidden_topics: jsonb('forbidden_topics')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    active_model: text('active_model').notNull().default('google/gemini-2.5-pro'),
    ab_test_enabled: boolean('ab_test_enabled').notNull().default(false),
    ab_test_split: jsonb('ab_test_split')
      .$type<TAbBucket[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    context_window_messages: smallint('context_window_messages').notNull().default(10),
    context_token_limit: integer('context_token_limit').notNull().default(4000),
    vk_photos_enabled: boolean('vk_photos_enabled').notNull().default(false),
    vk_voice_enabled: boolean('vk_voice_enabled').notNull().default(false),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex('communities_vk_group_id_uq').on(t.vk_group_id)]
);

// --- prompts ---
export const prompts = pgTable(
  'prompts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    community_id: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    system_prompt: text('system_prompt').notNull(),
    is_active: boolean('is_active').notNull().default(false),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex('prompts_community_version_uq').on(t.community_id, t.version),
    index('prompts_community_active_idx').on(t.community_id, t.is_active)
  ]
);

// --- landing_links ---
export const landing_links = pgTable(
  'landing_links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    community_id: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    placeholder_key: text('placeholder_key').notNull(),
    name: text('name').notNull(),
    base_url: text('base_url').notNull(),
    utm_source: text('utm_source').notNull().default(''),
    utm_medium: text('utm_medium').notNull().default(''),
    utm_campaign: text('utm_campaign').notNull().default(''),
    is_active: boolean('is_active').notNull().default(true),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex('landing_links_community_key_uq').on(t.community_id, t.placeholder_key)]
);

// --- offer_packs ---
// Последовательные пачки готовых ссылок-офферов. Бот шлёт их по очереди
// после показа витрины — на каждое сообщение пользователя следующую пачку.
// Контент — многострочный текст вида "Название МФО 👉 https://...".
export const offer_packs = pgTable(
  'offer_packs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    community_id: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    order_index: smallint('order_index').notNull(),
    content: text('content').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex('offer_packs_community_order_uq').on(t.community_id, t.order_index),
    index('offer_packs_community_idx').on(t.community_id, t.order_index)
  ]
);

// --- dialogs ---
export const dialogs = pgTable(
  'dialogs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    community_id: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    vk_user_id: bigint('vk_user_id', { mode: 'number' }).notNull(),
    vk_user_first_name: text('vk_user_first_name'),
    vk_user_last_name: text('vk_user_last_name'),
    // VK Ads ref-tags из первого message_new (если юзер пришёл по рекламной ссылке).
    // Замораживаются на первом сообщении и переиспользуются в UTM витрины и пачек.
    ref: text('ref'),
    ref_source: text('ref_source'),
    status: text('status').$type<TDialogStatus>().notNull().default('active'),
    bucket_model: text('bucket_model'),
    total_messages: integer('total_messages').notNull().default(0),
    total_tokens_input: integer('total_tokens_input').notNull().default(0),
    total_tokens_output: integer('total_tokens_output').notNull().default(0),
    total_cost_usd: numeric('total_cost_usd', { precision: 12, scale: 6 })
      .notNull()
      .default('0'),
    converted_at: timestamp('converted_at', { withTimezone: true }),
    conversion_link_id: uuid('conversion_link_id').references(() => landing_links.id, {
      onDelete: 'set null'
    }),
    last_message_at: timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow(),
    nudge_count: smallint('nudge_count').notNull().default(0),
    // Сколько offer-пачек уже отправили в этот диалог — индекс следующей по order_index
    packs_sent_count: smallint('packs_sent_count').notNull().default(0),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex('dialogs_community_user_uq').on(t.community_id, t.vk_user_id),
    index('dialogs_community_status_idx').on(t.community_id, t.status),
    index('dialogs_community_last_message_idx').on(t.community_id, t.last_message_at)
  ]
);

// --- messages ---
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    dialog_id: uuid('dialog_id')
      .notNull()
      .references(() => dialogs.id, { onDelete: 'cascade' }),
    role: text('role').$type<TMessageRole>().notNull(),
    content: text('content').notNull(),
    attachments: jsonb('attachments')
      .$type<TAttachment[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    model_used: text('model_used'),
    tokens_input: integer('tokens_input'),
    tokens_output: integer('tokens_output'),
    cost_usd: numeric('cost_usd', { precision: 12, scale: 6 }),
    latency_ms: integer('latency_ms'),
    link_sent_id: uuid('link_sent_id').references(() => landing_links.id, {
      onDelete: 'set null'
    }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('messages_dialog_created_idx').on(t.dialog_id, t.created_at)]
);

// --- metrics_hourly ---
export const metrics_hourly = pgTable(
  'metrics_hourly',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    community_id: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    hour_bucket: timestamp('hour_bucket', { withTimezone: true }).notNull(),
    model_used: text('model_used').notNull(),
    dialogs_started: integer('dialogs_started').notNull().default(0),
    dialogs_converted: integer('dialogs_converted').notNull().default(0),
    dialogs_nudged: integer('dialogs_nudged').notNull().default(0),
    total_messages: integer('total_messages').notNull().default(0),
    total_tokens_input: integer('total_tokens_input').notNull().default(0),
    total_tokens_output: integer('total_tokens_output').notNull().default(0),
    total_cost_usd: numeric('total_cost_usd', { precision: 12, scale: 6 })
      .notNull()
      .default('0'),
    sum_latency_ms: bigint('sum_latency_ms', { mode: 'number' }).notNull().default(0),
    count_latency_samples: integer('count_latency_samples').notNull().default(0)
  },
  (t) => [
    uniqueIndex('metrics_hourly_bucket_model_uq').on(t.community_id, t.hour_bucket, t.model_used)
  ]
);

// --- model_prices ---
export const model_prices = pgTable('model_prices', {
  model: text('model').primaryKey(),
  prompt_price_per_1m: numeric('prompt_price_per_1m', { precision: 10, scale: 4 }).notNull(),
  completion_price_per_1m: numeric('completion_price_per_1m', { precision: 10, scale: 4 }).notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

// --- vk_events_processed ---
export const vk_events_processed = pgTable(
  'vk_events_processed',
  {
    event_id: text('event_id').primaryKey(),
    processed_at: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('vk_events_processed_at_idx').on(t.processed_at)]
);

// --- inferred row types (для использования в сервисах) ---
export type TCommunity = typeof communities.$inferSelect;
export type TCommunityInsert = typeof communities.$inferInsert;
export type TPrompt = typeof prompts.$inferSelect;
export type TPromptInsert = typeof prompts.$inferInsert;
export type TLandingLink = typeof landing_links.$inferSelect;
export type TLandingLinkInsert = typeof landing_links.$inferInsert;
export type TOfferPack = typeof offer_packs.$inferSelect;
export type TOfferPackInsert = typeof offer_packs.$inferInsert;
export type TDialog = typeof dialogs.$inferSelect;
export type TDialogInsert = typeof dialogs.$inferInsert;
export type TMessage = typeof messages.$inferSelect;
export type TMessageInsert = typeof messages.$inferInsert;
export type TMetricsHourly = typeof metrics_hourly.$inferSelect;
export type TModelPrice = typeof model_prices.$inferSelect;
