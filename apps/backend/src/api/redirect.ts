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

    let dialogRef: string | null = null;
    let dialogRefSource: string | null = null;

    // Если есть валидный dialog_id, диалог принадлежит этому community —
    // (а) забираем ref/ref_source для UTM, (б) фиксируем первую конверсию.
    if (dialogId) {
      try {
        const [dialog] = await db
          .select({
            id: dialogs.id,
            ref: dialogs.ref,
            ref_source: dialogs.ref_source,
            converted_at: dialogs.converted_at
          })
          .from(dialogs)
          .where(and(eq(dialogs.id, dialogId), eq(dialogs.community_id, link.community_id)))
          .limit(1);

        if (dialog) {
          dialogRef = dialog.ref;
          dialogRefSource = dialog.ref_source;
          if (!dialog.converted_at) {
            await db
              .update(dialogs)
              .set({ converted_at: sql`NOW()`, conversion_link_id: link.id })
              .where(and(eq(dialogs.id, dialogId), isNull(dialogs.converted_at)));
          }
        }
      } catch (err) {
        // Логируем, но всё равно редиректим — пользователь не виноват в нашей ошибке БД.
        logger.warn({ err, dialogId, linkId: link.id }, 'Failed to load dialog / record conversion');
      }
    }

    const target = buildLandingUrl({
      baseUrl: link.base_url,
      utmSource: link.utm_source,
      ref: dialogRef,
      refSource: dialogRefSource,
      vkUserId: vkUid ?? 0
    });

    return reply.redirect(target, 302);
  });
};
