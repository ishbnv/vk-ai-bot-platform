import { asc, count, eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { offer_packs } from '@/db/schema';

const NEXT_PACK_PLACEHOLDER = '{{NEXT_PACK}}';

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

type TReplaceResult = {
  text: string;
  consumed: boolean; // true если плейсхолдер был и удалось его подставить (надо инкрементить)
};

// Подставляет следующую по order_index пачку. Если пачки кончились — выпиливает
// плейсхолдер из текста, чтобы пользователь не увидел сырой {{NEXT_PACK}}.
export const replaceNextPackPlaceholder = async (
  text: string,
  communityId: string,
  packsSentCount: number
): Promise<TReplaceResult> => {
  if (!hasNextPackPlaceholder(text)) {
    return { text, consumed: false };
  }

  const packs = await db
    .select()
    .from(offer_packs)
    .where(eq(offer_packs.community_id, communityId))
    .orderBy(asc(offer_packs.order_index))
    .limit(packsSentCount + 1);

  const next = packs[packsSentCount];
  if (!next) {
    // Пачки закончились — убираем плейсхолдер, чтобы юзер его не увидел в чистом виде.
    return { text: text.replaceAll(NEXT_PACK_PLACEHOLDER, '').trim(), consumed: false };
  }

  // Двойной перевод строки чтобы визуально отделить ввод бота от списка ссылок.
  const replacement = `\n\n${next.content}`;
  return {
    text: text.replaceAll(NEXT_PACK_PLACEHOLDER, replacement).trim(),
    consumed: true
  };
};
