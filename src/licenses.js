import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// License keys are shown once; only an HMAC hash is stored.
export const hashKey = (secret, key) => createHmac('sha256', secret).update(key).digest('hex');

export function issueKey(store, secret, label = '') {
  if (!secret) throw new Error('LICENSE_HASH_SECRET is not set');
  const key = 'plk_' + randomBytes(24).toString('hex');
  const all = store.read('licenses', []);
  all.push({ hash: hashKey(secret, key), label, created: new Date().toISOString(), revoked: false });
  store.write('licenses', all);
  return key;
}

export function verifyKey(store, secret, key) {
  if (!secret || !key) return false;
  const h = Buffer.from(hashKey(secret, key));
  return store.read('licenses', []).some((l) => {
    const lh = Buffer.from(l.hash);
    return !l.revoked && lh.length === h.length && timingSafeEqual(lh, h);
  });
}
