import { describe, it, expect } from 'vitest';

import { encrypt, decrypt } from './crypto';

describe('crypto encrypt/decrypt', () => {
  it('round-trips a string', () => {
    const plain = 'vk1.a.long-secret-token-abcdef';
    const encrypted = encrypt(plain);
    expect(encrypted).not.toContain(plain);
    expect(decrypt(encrypted)).toBe(plain);
  });

  it('produces different ciphertexts for the same plain (random IV)', () => {
    const plain = 'same-secret';
    expect(encrypt(plain)).not.toBe(encrypt(plain));
  });

  it('throws on malformed ciphertext', () => {
    expect(() => decrypt('garbage')).toThrow();
  });
});
