import type { FastifyInstance } from 'fastify';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/db/client';
import { dialogs, landing_links } from '@/db/schema';
import { logger } from '@/lib/logger';
import { buildLandingUrl } from '@/services/dialog/landing-url';

const paramsSchema = z.object({ linkId: z.string().uuid() });
const querySchema = z.object({
  vk_uid: z.coerce.number().int().optional(),
  dialog_id: z.string().uuid().optional()
});

export const redirectRoutes = async (app: FastifyInstance) => {
  app.get('/:linkId', async (request, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) return reply.code(404).send('not_found');

    const [link] = await db
      .select()
      .from(landing_links)
      .where(eq(landing_links.id, params.data.linkId))
      .limit(1);
    if (!link) return reply.code(404).send('not_found');

    const query = querySchema.safeParse(request.query);
    const vkUid = query.success ? query.data.vk_uid : undefined;
    const dialogId = query.success ? query.data.dialog_id : undefined;

    // Фиксируем конверсию только если есть валидный dialog_id, диалог принадлежит этому
    // community и ещё не помечен converted_at — первый клик выигрывает.
    if (dialogId) {
      try {
        await db
          .update(dialogs)
          .set({ converted_at: sql`NOW()`, conversion_link_id: link.id })
          .where(
            and(
              eq(dialogs.id, dialogId),
              eq(dialogs.community_id, link.community_id),
              isNull(dialogs.converted_at)
            )
          );
      } catch (err) {
        // Логируем, но всё равно редиректим — пользователь не виноват в нашей ошибке БД.
        logger.warn({ err, dialogId, linkId: link.id }, 'Failed to record conversion');
      }
    }

    const target = buildLandingUrl(
      link.base_url,
      {
        utm_source: link.utm_source,
        utm_medium: link.utm_medium,
        utm_campaign: link.utm_campaign
      },
      { vkUserId: vkUid, dialogId }
    );

    return reply.redirect(target, 302);
  });
};
