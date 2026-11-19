import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { makeLimiter } from '../src/ratelimit.js';
import { requestApproval, decide, isApproved } from '../src/approvals.js';
import { redact } from '../src/audit.js';

async function start(over = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'plk-'));
  const cfg = { ...loadConfig({}), dataDir: dir, licenseSecret: 's3', adminToken: 'adm', ...over };
  const app = buildApp(cfg);
  await new Promise((r) => app.server.listen(0, r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  return { app, base, dir, close: () => app.server.close() };
}

test('free lesson open, pro gated, key unlocks', async () => {
  const t = await start();
  assert.equal((await fetch(t.base + '/api/lessons/git-1')).status, 200);
  assert.equal((await fetch(t.base + '/api/lessons/git-2')).status, 402);
  const k = await (await fetch(t.base + '/api/admin/keys', { method: 'POST', headers: { Authorization: 'Bearer adm' }, body: '{}' })).json();
  const ok = await fetch(t.base + '/api/lessons/git-2', { headers: { Authorization: 'Bearer ' + k.key } });
  assert.equal(ok.status, 200);
  assert.ok(!readFileSync(join(t.dir, 'licenses.json'), 'utf8').includes(k.key), 'key not stored in plaintext');
  assert.ok(!readFileSync(join(t.dir, 'audit.jsonl'), 'utf8').includes(k.key));
  t.close();
});

test('admin route rejects bad token', async () => {
  const t = await start();
  assert.equal((await fetch(t.base + '/api/admin/keys', { method: 'POST', headers: { Authorization: 'Bearer no' } })).status, 401);
  t.close();
});

test('waitlist validates and checkout is stub without Stripe', async () => {
  const t = await start();
  assert.equal((await fetch(t.base + '/api/waitlist', { method: 'POST', body: '{"email":"bad"}' })).status, 400);
  assert.equal((await fetch(t.base + '/api/waitlist', { method: 'POST', body: '{"email":"a@b.co"}' })).status, 200);
  const c = await (await fetch(t.base + '/api/checkout', { method: 'POST', body: '{}' })).json();
  assert.equal(c.mode, 'stub');
  t.close();
});

test('live checkout stays stub unless owner approval flag is set', async () => {
  const t = await start({ stripeKey: 'sk_test_x', stripePrice: 'price_x', livePaymentsApproved: false });
  assert.equal((await (await fetch(t.base + '/api/checkout', { method: 'POST', body: '{}' })).json()).mode, 'stub');
  t.close();
});

test('rate limiter blocks over limit', () => {
  let n = 0; const l = makeLimiter(2, 1000, () => n);
  assert.deepEqual([l('a'), l('a'), l('a')], [true, true, false]);
  n = 1001; assert.equal(l('a'), true);
});

test('http rate limit returns 429', async () => {
  const t = await start({ rateMax: 2 });
  const codes = []; for (let i = 0; i < 3; i++) codes.push((await fetch(t.base + '/healthz')).status);
  assert.deepEqual(codes, [200, 200, 429]);
  t.close();
});

test('approval gate: pending until human decides; audit redacts secrets', async () => {
  const t = await start();
  const a = requestApproval(t.app.store, t.app.audit, 'outbound', { to: 'x' });
  assert.equal(isApproved(t.app.store, a.id), false);
  decide(t.app.store, t.app.audit, a.id, true, 'owner');
  assert.equal(isApproved(t.app.store, a.id), true);
  assert.throws(() => requestApproval(t.app.store, t.app.audit, 'bogus', {}));
  assert.deepEqual(redact({ apiKey: 'x', n: 1 }), { apiKey: '[REDACTED]', n: 1 });
  t.close();
});
