import { encode } from 'gpt-tokenizer';

// Грубая оценка для всех моделей через cl100k_base.
// Для не-OpenAI моделей отклонение есть, но в пределах 10–15% — для бюджета окна достаточно.
export const countTokens = (text: string): number => encode(text).length;
