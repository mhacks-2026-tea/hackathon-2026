import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { ChatState } from './conversation';

export const CHAT_COOKIE = 'movin-chat';
const lifetime = 600;
function key() {
  const secret = process.env.MOVIN_CHAT_SECRET || process.env.ASI1_API_KEY;
  if (!secret) throw new Error('Configure ASI1_API_KEY or MOVIN_CHAT_SECRET.');
  return createHash('sha256').update(secret).digest();
}
/** Encrypted authenticated state survives Vercel instances without shared process memory. */
export function sealChat(state: ChatState): string {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify({ ...state, expires: Date.now() + lifetime * 1000 })), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}
export function openChat(token?: string): ChatState | undefined {
  if (!token || token.length > 3800) return undefined;
  try {
    const bytes = Buffer.from(token, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const data = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString());
    return data.expires > Date.now() ? data as ChatState : undefined;
  } catch { return undefined; }
}
