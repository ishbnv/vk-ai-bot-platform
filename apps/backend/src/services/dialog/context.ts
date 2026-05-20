import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { desc, eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { messages } from '@/db/schema';
import { countTokens } from '@/services/context/tokens';

type TBuildOptions = {
  windowMessages: number;
  tokenLimit: number;
};

export const buildContext = async (
  dialogId: string,
  systemPrompt: string,
  options: TBuildOptions
): Promise<ChatCompletionMessageParam[]> => {
  // Берём с запасом — потом отрежем сверху по токенам
  const recent = await db
    .select()
    .from(messages)
    .where(eq(messages.dialog_id, dialogId))
    .orderBy(desc(messages.created_at))
    .limit(options.windowMessages * 2);

  const ordered = [...recent].reverse(); // в хронологическом порядке

  const systemTokens = countTokens(systemPrompt);
  let total = systemTokens;
  const included: typeof ordered = [];

  // Идём с конца к началу, чтобы оставить максимум свежих сообщений
  for (let i = ordered.length - 1; i >= 0; i--) {
    const msg = ordered[i];
    if (!msg) continue;
    if (msg.role === 'system') continue; // системные не дублируем — мы добавим свой
    const tokens = countTokens(msg.content);
    if (total + tokens > options.tokenLimit) break;
    included.unshift(msg);
    total += tokens;
  }

  return [
    { role: 'system', content: systemPrompt },
    ...included.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }))
  ];
};
