export class VkApiError extends Error {
  public readonly code: number;
  public readonly method: string;

  constructor(method: string, code: number, message: string) {
    super(`VK ${method} failed [${code}]: ${message}`);
    this.name = 'VkApiError';
    this.code = code;
    this.method = method;
  }
}

// Retriable: сетевые ошибки + flood control (6) + too many per second (29) + internal (10)
const RETRIABLE_CODES = new Set([6, 9, 10, 29]);

export const isRetriable = (err: unknown): boolean => {
  if (err instanceof VkApiError) return RETRIABLE_CODES.has(err.code);
  // fetch network errors → retry
  return err instanceof Error;
};
