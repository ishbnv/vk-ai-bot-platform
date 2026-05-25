import { describe, it, expect } from 'vitest';

import { buildLandingUrl } from './landing-url';

describe('buildLandingUrl', () => {
  it('заполняет все 4 UTM из ref-контекста', () => {
    const url = buildLandingUrl({
      baseUrl: 'https://mfo.example.com/landing',
      utmSource: 'vk-vit1',
      ref: 'ad_42',
      refSource: 'feed',
      vkUserId: 12345
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('utm_source')).toBe('vk-vit1');
    expect(parsed.searchParams.get('utm_campaign')).toBe('ad_42');
    expect(parsed.searchParams.get('utm_content')).toBe('feed');
    expect(parsed.searchParams.get('utm_term')).toBe('12345');
  });

  it('сохраняет существующий query в base_url', () => {
    const url = buildLandingUrl({
      baseUrl: 'https://mfo.example.com/landing?ref=partner',
      utmSource: 'vk-vit1',
      vkUserId: 1
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('ref')).toBe('partner');
    expect(parsed.searchParams.get('utm_source')).toBe('vk-vit1');
  });

  it('подставляет пустые utm_campaign/utm_content если ref отсутствует (органика)', () => {
    const url = buildLandingUrl({
      baseUrl: 'https://x/y',
      utmSource: 'vk-vit1',
      vkUserId: 7
    });
    expect(url).toContain('utm_source=vk-vit1');
    expect(url).toContain('utm_campaign=');
    expect(url).toContain('utm_content=');
    expect(url).toContain('utm_term=7');
  });
});
