import { env } from '@/env';
import { logger } from '@/lib/logger';

import { VkApiError, isRetriable } from './errors';

type TVkParams = Record<string, string | number | boolean | undefined>;
type TVkSuccess<T> = { response: T };
type TVkFailure = {
  error: { error_code: number; error_msg: string; request_params?: unknown };
};
type TVkRaw<T> = TVkSuccess<T> | TVkFailure;

const VK_API_URL = 'https://api.vk.com/method';

const buildBody = (params: TVkParams, token: string): URLSearchParams => {
  const body = new URLSearchParams();
  body.set('access_token', token);
  body.set('v', env.VK_API_VERSION);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    body.set(k, String(v));
  }
  return body;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type TCallOptions = { retries?: number; baseDelayMs?: number };

export const vkCall = async <T>(
  method: string,
  params: TVkParams,
  token: string,
  options: TCallOptions = {}
): Promise<T> => {
  const { retries = 3, baseDelayMs = 200 } = options;
  let attempt = 0;
  let lastErr: unknown;

  while (attempt <= retries) {
    try {
      const res = await fetch(`${VK_API_URL}/${method}`, {
        method: 'POST',
        body: buildBody(params, token)
      });
      const json = (await res.json()) as TVkRaw<T>;

      if ('error' in json) {
        throw new VkApiError(method, json.error.error_code, json.error.error_msg);
      }
      return json.response;
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !isRetriable(err)) throw err;
      const delay = baseDelayMs * 2 ** attempt;
      logger.warn({ method, attempt, delay, err }, 'VK call retrying');
      await sleep(delay);
      attempt += 1;
    }
  }
  // Недостижимо — цикл всегда либо вернёт, либо бросит.
  throw lastErr;
};
