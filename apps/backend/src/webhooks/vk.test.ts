import { describe, it, expect } from 'vitest';

import { vkWebhookSchema, vkMessageNewObjectSchema } from './schemas';

describe('vkWebhookSchema', () => {
  it('accepts a confirmation request', () => {
    const r = vkWebhookSchema.safeParse({
      type: 'confirmation',
      group_id: 123
    });
    expect(r.success).toBe(true);
  });

  it('accepts a message_new event', () => {
    const r = vkWebhookSchema.safeParse({
      type: 'message_new',
      group_id: 123,
      secret: 'abc',
      event_id: 'evt-1',
      object: { message: { from_id: 1, peer_id: 1, date: 0, text: 'hi' } }
    });
    expect(r.success).toBe(true);
  });

  it('rejects payload without type', () => {
    const r = vkWebhookSchema.safeParse({ group_id: 1 });
    expect(r.success).toBe(false);
  });

  it('rejects payload with non-numeric group_id', () => {
    const r = vkWebhookSchema.safeParse({ type: 'message_new', group_id: 'oops' });
    expect(r.success).toBe(false);
  });
});

describe('vkMessageNewObjectSchema', () => {
  it('extracts message fields from a real-ish payload', () => {
    const r = vkMessageNewObjectSchema.safeParse({
      message: {
        from_id: 42,
        peer_id: 42,
        date: 1_700_000_000,
        text: 'Привет',
        attachments: [{ type: 'photo', photo: { id: 1 } }]
      },
      client_info: { button_actions: ['text'] }
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.message.text).toBe('Привет');
      expect(r.data.message.attachments?.[0]?.type).toBe('photo');
    }
  });

  it('rejects message without text', () => {
    const r = vkMessageNewObjectSchema.safeParse({
      message: { from_id: 1, peer_id: 1, date: 0 }
    });
    expect(r.success).toBe(false);
  });
});
