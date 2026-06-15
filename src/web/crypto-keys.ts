import * as crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const KEY_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;

let masterKey: Buffer;

export function initCrypto(secret?: string): void {
  if (secret && secret.length >= 32) {
    masterKey = Buffer.from(secret.substring(0, 32), 'utf-8');
  } else if (secret) {
    masterKey = crypto.scryptSync(secret, 'diffsense-salt', KEY_LEN);
  } else {
    masterKey = crypto.randomBytes(KEY_LEN);
  }
}

export function encryptApiKey(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted.toString('hex');
}

export function decryptApiKey(encoded: string): string {
  const parts = encoded.split(':');
  if (parts.length !== 3) throw new Error('无效的加密格式');
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const encrypted = Buffer.from(parts[2], 'hex');
  const decipher = crypto.createDecipheriv(ALGO, masterKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf-8');
}
