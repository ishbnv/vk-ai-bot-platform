import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { communities, prompts, type TCommunity } from '@/db/schema';
import { env } from '@/env';
import { encrypt } from '@/lib/crypto';
import { logger } from '@/lib/logger';
import {
  addCallbackServer,
  getCallbackConfirmationCode,
  getGroupById,
  setCallbackSettings
} from '@/services/vk';
import { BASE_SYSTEM_PROMPT } from '@/services/prompts/template';

import { seedDefaultOfferPacks } from './seed-default-packs';

type TConnectArgs = {
  vkGroupId: number;
  vkAccessToken: string;
  name?: string;
};

// Подключение нового VK-сообщества: валидируем токен, регистрируем callback server,
// шифруем токен, создаём community + базовый prompt v1.
export const connectCommunity = async ({
  vkGroupId,
  vkAccessToken,
  name
}: TConnectArgs): Promise<TCommunity> => {
  // 0. duplicate check
  const [existing] = await db
    .select()
    .from(communities)
    .where(eq(communities.vk_group_id, vkGroupId))
    .limit(1);
  if (existing) throw new Error(`Community for vk_group_id=${vkGroupId} already exists`);

  // 1. validate token + fetch group meta
  const group = await getGroupById(vkAccessToken, vkGroupId);

  // 2. confirmation code (нужен ДО регистрации, чтобы webhook handler сразу отдал его VK)
  const confirmationCode = await getCallbackConfirmationCode(vkAccessToken, vkGroupId);

  // 3. random secret + encrypted token
  const callbackSecret = randomBytes(24).toString('hex');
  const tokenEncrypted = encrypt(vkAccessToken);

  // 4. INSERT community + base prompt в одной транзакции
  const [community] = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(communities)
      .values({
        vk_group_id: vkGroupId,
        vk_access_token_encrypted: tokenEncrypted,
        vk_callback_secret: callbackSecret,
        vk_callback_confirmation_code: confirmationCode,
        name: name ?? group.name
      })
      .returning();
    const c = inserted[0];
    if (!c) throw new Error('Insert community returned no rows');
    await tx.insert(prompts).values({
      community_id: c.id,
      version: 1,
      system_prompt: BASE_SYSTEM_PROMPT,
      is_active: true
    });
    return inserted;
  });

  if (!community) throw new Error('Community not created');

  // 4.5. Сидим дефолтные пачки офферов (4 priority-списка из старой n8n-сборки).
  // Если упало — community/prompt уже сохранены, не критично, в админке можно добавить руками.
  try {
    await seedDefaultOfferPacks(community.id);
  } catch (err) {
    logger.warn({ err, communityId: community.id }, 'seed default offer packs failed');
  }

  // 5. Регистрация callback на стороне VK — после INSERT, иначе confirmation request придёт раньше БД.
  try {
    const serverId = await addCallbackServer(vkAccessToken, {
      groupId: vkGroupId,
      url: `${env.PUBLIC_URL}/webhooks/vk`,
      title: 'gidfinance-bot',
      secretKey: callbackSecret
    });
    await setCallbackSettings(vkAccessToken, {
      groupId: vkGroupId,
      serverId,
      apiVersion: env.VK_API_VERSION,
      events: { message_new: true, message_reply: true }
    });
    logger.info({ communityId: community.id, serverId }, 'Community connected');
  } catch (err) {
    // Сообщество уже сохранено — VK callback можно перепривязать руками или повторным PATCH.
    logger.warn(
      { err, communityId: community.id },
      'VK callback registration failed — community saved without active callback'
    );
  }

  return community;
};
