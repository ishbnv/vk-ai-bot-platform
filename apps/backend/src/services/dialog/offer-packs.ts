import { and, asc, count, eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { landing_links, offer_packs } from '@/db/schema';

const NEXT_PACK_PLACEHOLDER = '{{NEXT_PACK}}';
const SHOWCASE_KEY = 'LINK_SHOWCASE';

export const hasNextPackPlaceholder = (text: string): boolean =>
  text.includes(NEXT_PACK_PLACEHOLDER);

// Возвращает общее число пачек у community (для метки в системном промпте).
export const countPacks = async (communityId: string): Promise<number> => {
  const [row] = await db
    .select({ value: count() })
    .from(offer_packs)
    .where(eq(offer_packs.community_id, communityId));
  return row?.value ?? 0;
};

// Подменяет в content пачки переменные на актуальный контекст диалога.
// Поддерживаемые токены:
//   {utm_source}  — utm_source витрины (LINK_SHOWCASE), либо пустая строка
//   {batch}       — order_index текущей пачки
//   {ref}         — dialog.ref (VK Ads), либо пусто
//   {ref_source}  — dialog.ref_source, либо пусто
//   {vk_user_id}  — dialog.vk_user_id
export const substitutePackVariables = (
  content: string,
  vars: {
    utmSource: string;
    batch: number;
    ref: string;
    refSource: string;
    vkUserId: number;
  }
): string =>
  content
    .replaceAll('{utm_source}', vars.utmSource)
    .replaceAll('{batch}', String(vars.batch))
    .replaceAll('{ref}', vars.ref)
    .replaceAll('{ref_source}', vars.refSource)
    .replaceAll('{vk_user_id}', String(vars.vkUserId));

type TReplaceArgs = {
  text: string;
  communityId: string;
  packsSentCount: number;
  vkUserId: number;
  ref: string | null;
  refSource: string | null;
};

type TReplaceResult = {
  text: string;
  consumed: boolean; // true если плейсхолдер был и удалось его подставить (надо инкрементить)
};

// Подставляет следующую по order_index пачку. Если пачки кончились — выпиливает
// плейсхолдер из текста, чтобы пользователь не увидел сырой {{NEXT_PACK}}.
export const replaceNextPackPlaceholder = async (
  args: TReplaceArgs
): Promise<TReplaceResult> => {
  if (!hasNextPackPlaceholder(args.text)) {
    return { text: args.text, consumed: false };
  }

  const packs = await db
    .select()
    .from(offer_packs)
    .where(eq(offer_packs.community_id, args.communityId))
    .orderBy(asc(offer_packs.order_index))
    .limit(args.packsSentCount + 1);

  const next = packs[args.packsSentCount];
  if (!next) {
    // Пачки закончились — убираем плейсхолдер, чтобы юзер его не увидел в чистом виде.
    return {
      text: args.text.replaceAll(NEXT_PACK_PLACEHOLDER, '').trim(),
      consumed: false
    };
  }

  // utm_source берём с витрины (LINK_SHOWCASE) того же community — она задаёт
  // канал для всех ссылок диалога. Если витрина не настроена — пустая строка.
  const [showcase] = await db
    .select({ utm_source: landing_links.utm_source })
    .from(landing_links)
    .where(
      and(
        eq(landing_links.community_id, args.communityId),
        eq(landing_links.placeholder_key, SHOWCASE_KEY)
      )
    )
    .limit(1);

  const rendered = substitutePackVariables(next.content, {
    utmSource: showcase?.utm_source ?? '',
    batch: next.order_index,
    ref: args.ref ?? '',
    refSource: args.refSource ?? '',
    vkUserId: args.vkUserId
  });

  return {
    text: args.text.replaceAll(NEXT_PACK_PLACEHOLDER, `\n\n${rendered}`).trim(),
    consumed: true
  };
};
