import { describe, it, expect } from 'vitest';

import {
  extractPlaceholders,
  buildRedirectUrl,
  applyReplacements
} from './placeholders';

describe('extractPlaceholders', () => {
  it('returns unique keys from text', () => {
    const keys = extractPlaceholders('check {{LINK_OFFER}} and {{LINK_FAST}}');
    expect(keys.sort()).toEqual(['LINK_FAST', 'LINK_OFFER']);
  });

  it('deduplicates repeated placeholders', () => {
    const keys = extractPlaceholders('{{LINK_OFFER}} blah {{LINK_OFFER}}');
    expect(keys).toEqual(['LINK_OFFER']);
  });

  it('returns empty for text without placeholders', () => {
    expect(extractPlaceholders('просто текст без ссылок')).toEqual([]);
  });

  it('ignores non-LINK placeholders', () => {
    expect(extractPlaceholders('{{community_name}} {{LINK_X}}')).toEqual(['LINK_X']);
  });
});

describe('buildRedirectUrl', () => {
  it('encodes vk_uid and dialog_id as query', () => {
    const url = buildRedirectUrl(
      'https://bot.example.com',
      'link-abc',
      12345,
      'dialog-uuid'
    );
    expect(url).toBe(
      'https://bot.example.com/r/link-abc?vk_uid=12345&dialog_id=dialog-uuid'
    );
  });

  it('respects publicUrl with trailing slash', () => {
    const url = buildRedirectUrl('https://bot.example.com/', 'l1', 1, 'd1');
    expect(url).toBe('https://bot.example.com/r/l1?vk_uid=1&dialog_id=d1');
  });
});

describe('applyReplacements', () => {
  it('replaces matched keys', () => {
    const out = applyReplacements('go to {{LINK_OFFER}} now', {
      LINK_OFFER: 'https://x/r/1'
    });
    expect(out).toBe('go to https://x/r/1 now');
  });

  it('leaves unmatched placeholders intact', () => {
    const out = applyReplacements('see {{LINK_FAST}} and {{LINK_SLOW}}', {
      LINK_FAST: 'https://x/r/fast'
    });
    expect(out).toBe('see https://x/r/fast and {{LINK_SLOW}}');
  });

  it('replaces multiple occurrences of the same key', () => {
    const out = applyReplacements('{{LINK_OFFER}} again {{LINK_OFFER}}', {
      LINK_OFFER: 'X'
    });
    expect(out).toBe('X again X');
  });
});
