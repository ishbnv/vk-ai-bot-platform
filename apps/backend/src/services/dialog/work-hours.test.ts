import { describe, it, expect } from 'vitest';

import { computeWorkHoursDelay } from './work-hours';

// helper: построить Date так, чтобы по Москве (UTC+3) было заданное локальное время
const moscow = (year: number, month1: number, day: number, hour: number, min = 0): Date =>
  new Date(Date.UTC(year, month1 - 1, day, hour - 3, min));

describe('computeWorkHoursDelay', () => {
  it('returns 0 inside work window', () => {
    // 14:00 МСК, окно 9..22 → внутри
    expect(computeWorkHoursDelay(9, 22, moscow(2026, 5, 19, 14))).toBe(0);
  });

  it('returns 0 for 24h work (0..24)', () => {
    expect(computeWorkHoursDelay(0, 24, moscow(2026, 5, 19, 3, 30))).toBe(0);
  });

  it('delays until today work_start when current hour < work_start', () => {
    // 6:00 МСК, окно 9..22 → нужно подождать 3 часа
    const delay = computeWorkHoursDelay(9, 22, moscow(2026, 5, 19, 6));
    expect(delay).toBe(3 * 60 * 60 * 1000);
  });

  it('delays until tomorrow work_start when current hour >= work_end', () => {
    // 23:00 МСК, окно 9..22 → следующий старт 9:00 завтра = 10 часов
    const delay = computeWorkHoursDelay(9, 22, moscow(2026, 5, 19, 23));
    expect(delay).toBe(10 * 60 * 60 * 1000);
  });

  it('handles work_end at exact hour boundary correctly', () => {
    // 22:00 МСК, окно 9..22 → end exclusive, 22:00 уже нерабочее → 11h
    const delay = computeWorkHoursDelay(9, 22, moscow(2026, 5, 19, 22));
    expect(delay).toBe(11 * 60 * 60 * 1000);
  });

  it('returns 0 on inverted/invalid window', () => {
    expect(computeWorkHoursDelay(22, 9, moscow(2026, 5, 19, 14))).toBe(0);
  });
});
