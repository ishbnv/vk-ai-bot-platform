import { z } from 'zod';

// Базовая обёртка, общая для всех типов событий ВК Callback API
export const vkWebhookSchema = z.object({
  type: z.string(),
  group_id: z.number().int(),
  secret: z.string().optional(),
  event_id: z.string().optional(),
  v: z.string().optional(),
  object: z.unknown().optional()
});
export type TVkWebhook = z.infer<typeof vkWebhookSchema>;

// Конкретные типы события — для удобства проверки в worker'е
export const vkMessageNewObjectSchema = z.object({
  message: z.object({
    from_id: z.number().int(),
    peer_id: z.number().int(),
    date: z.number().int(),
    text: z.string(),
    attachments: z
      .array(z.object({ type: z.string() }).passthrough())
      .optional()
  })
});
export type TVkMessageNewObject = z.infer<typeof vkMessageNewObjectSchema>;
