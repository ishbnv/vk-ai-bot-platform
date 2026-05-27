import { redisConnection } from '@/lib/redis';

// Пишем в Redis свой random_id ПЕРЕД отправкой messages.send. Когда VK Callback
// присылает нам message_reply — сравниваем его random_id со списком наших, чтобы
// отличить эхо наших отправок от ответов BotHunter / менеджера.
//
// TTL 30 минут — message_reply обычно прилетает в течение секунд, но если ВК
// задержался / шёл retry — лучше с запасом.
const TTL_SEC = 30 * 60;

const key = (randomId: number | string): string => `vkbot:our-rnd:${randomId}`;

export const markOurRandomId = async (randomId: number | string): Promise<void> => {
  await redisConnection.set(key(randomId), '1', 'EX', TTL_SEC);
};

export const isOurRandomId = async (randomId: number | string): Promise<boolean> => {
  const v = await redisConnection.get(key(randomId));
  return v !== null;
};
