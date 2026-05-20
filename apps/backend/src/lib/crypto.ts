import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { env } from '@/env';

const ALGO = 'aes-256-gcm';
const KEY = Buffer.from(env.ENCRYPTION_KEY, 'hex'); // 32 bytes

if (KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY must decode to exactly 32 bytes');
}

// Формат: iv.ciphertext.tag (base64.base64.base64)
const SEP = '.';

export const encrypt = (plain: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), enc.toString('base64'), tag.toString('base64')].join(SEP);
};

export const decrypt = (encrypted: string): string => {
  const parts = encrypted.split(SEP);
  if (parts.length !== 3) throw new Error('Malformed encrypted value');
  const [ivB64, encB64, tagB64] = parts as [string, string, string];

  const decipher = createDecipheriv(ALGO, KEY, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(encB64, 'base64')),
    decipher.final()
  ]);
  return dec.toString('utf8');
};
