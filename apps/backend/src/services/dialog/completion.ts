import { sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { logger } from '@/lib/logger';

// Переводит молчащие диалоги в конечный статус: converted (был клик) или abandoned.
// Один SQL — обновляет все за раз.
export const processDialogCompletionJob = async (): Promise<void> => {
  // CTE: находим dialogs где last_message_at старше completion_silence_hours
  // и status либо active либо nudged.
  // converted_at IS NOT NULL → converted, иначе → abandoned.
  const result = await db.execute(sql`
    UPDATE dialogs d
    SET status = CASE WHEN d.converted_at IS NOT NULL THEN 'converted' ELSE 'abandoned' END
    FROM communities c
    WHERE d.community_id = c.id
      AND d.status IN ('active', 'nudged')
      AND d.last_message_at < NOW() - (c.completion_silence_hours * INTERVAL '1 hour')
  `);
  // pg-js возвращает количество в .count
  const affected = (result as unknown as { count?: number }).count ?? 0;
  logger.info({ affected }, 'dialog-completion: processed');
};
