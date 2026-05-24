import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

import { openrouter } from './client';
import { getModelPrice } from './prices';
import { calculateCost } from './cost';

export type TChatArgs = {
  model: string;
  messages: ChatCompletionMessageParam[];
  temperature?: number;
  maxTokens?: number;
};

export type TChatResult = {
  content: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
};

export const chat = async ({
  model,
  messages,
  temperature = 0.7,
  // 500 на Gemini 2.5 Pro обрезает середину предложения — берём с запасом
  maxTokens = 1500
}: TChatArgs): Promise<TChatResult> => {
  const start = Date.now();
  const response = await openrouter.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens
  });
  const latencyMs = Date.now() - start;

  const usage = response.usage;
  if (!usage) {
    throw new Error(`OpenRouter returned no usage for model ${model}`);
  }

  const price = await getModelPrice(model);
  const costUsd = calculateCost(usage.prompt_tokens, usage.completion_tokens, price);

  return {
    content: response.choices[0]?.message?.content ?? '',
    tokensIn: usage.prompt_tokens,
    tokensOut: usage.completion_tokens,
    costUsd,
    latencyMs
  };
};
