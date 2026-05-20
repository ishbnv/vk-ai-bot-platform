import { describe, it, expect } from 'vitest';

import { calculateCost } from './cost';

describe('calculateCost', () => {
  it('считает стоимость по тарифу за миллион токенов', () => {
    // 1000 prompt @ $2.5/1M + 500 completion @ $10/1M = $0.0025 + $0.005 = $0.0075
    const cost = calculateCost(1000, 500, {
      prompt_price_per_1m: '2.5',
      completion_price_per_1m: '10'
    });
    expect(cost).toBeCloseTo(0.0075, 6);
  });

  it('возвращает 0 при нулевом потреблении', () => {
    const cost = calculateCost(0, 0, {
      prompt_price_per_1m: '5',
      completion_price_per_1m: '15'
    });
    expect(cost).toBe(0);
  });

  it('работает с дробными ценами (sub-cent precision)', () => {
    // Реальный кейс: gemini flash ~ $0.075 / $0.30 за 1M
    const cost = calculateCost(10_000, 2_000, {
      prompt_price_per_1m: '0.075',
      completion_price_per_1m: '0.30'
    });
    // 10000 * 0.075 / 1e6 + 2000 * 0.30 / 1e6 = 0.00075 + 0.0006 = 0.00135
    expect(cost).toBeCloseTo(0.00135, 6);
  });
});
