import OpenAI from 'openai';

import { env } from '@/env';

export const openrouter = new OpenAI({
  apiKey: env.OPENROUTER_API_KEY,
  baseURL: env.OPENROUTER_BASE_URL,
  defaultHeaders: {
    'HTTP-Referer': env.PUBLIC_URL,
    'X-Title': 'VK AI Bot Platform'
  }
});
