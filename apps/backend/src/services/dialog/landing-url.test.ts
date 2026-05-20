import { describe, it, expect } from 'vitest';

import { buildLandingUrl } from './landing-url';

describe('buildLandingUrl', () => {
  it('appends utm and identifiers', () => {
    const url = buildLandingUrl(
      'https://mfo.example.com/landing',
      { utm_source: 'vk', utm_medium: 'bot', utm_campaign: 'spring' },
      { vkUserId: 42, dialogId: 'd-abc' }
    );
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://mfo.example.com/landing');
    expect(parsed.searchParams.get('utm_source')).toBe('vk');
    expect(parsed.searchParams.get('utm_medium')).toBe('bot');
    expect(parsed.searchParams.get('utm_campaign')).toBe('spring');
    expect(parsed.searchParams.get('vk_uid')).toBe('42');
    expect(parsed.searchParams.get('dialog_id')).toBe('d-abc');
  });

  it('preserves pre-existing query in base_url', () => {
    const url = buildLandingUrl(
      'https://mfo.example.com/landing?ref=partner',
      { utm_source: 'vk', utm_medium: '', utm_campaign: '' },
      {}
    );
    const parsed = new URL(url);
    expect(parsed.searchParams.get('ref')).toBe('partner');
    expect(parsed.searchParams.get('utm_source')).toBe('vk');
  });

  it('skips empty utm fields', () => {
    const url = buildLandingUrl(
      'https://x/y',
      { utm_source: '', utm_medium: '', utm_campaign: '' },
      { vkUserId: 1 }
    );
    expect(url).not.toContain('utm_source');
    expect(url).not.toContain('utm_medium');
    expect(url).not.toContain('utm_campaign');
    expect(url).toContain('vk_uid=1');
  });

  it('skips dialogId/vkUserId when not provided', () => {
    const url = buildLandingUrl(
      'https://x/y',
      { utm_source: 'a', utm_medium: 'b', utm_campaign: 'c' }
    );
    expect(url).not.toContain('vk_uid');
    expect(url).not.toContain('dialog_id');
  });
});
