import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

const SECRET = 'whsec_test_local';
async function start() {
  const dir = mkdtempSync(join(tmpdir(), 'plkw-'));
  const cfg = { ...loadConfig({ STRIPE_WEBHOOK_SECRET: SECRET, STRIPE_PRICE_PRO: 'price_pro' }), dataDir: dir, licenseSecret: 's3', adminToken: 'adm' };
  const app = buildApp(cfg);
  await new Promise((r) => app.server.listen(0, r));
  return { app, dir, base: `http://127.0.0.1:${app.server.address().port}`, close: () => app.server.close() };
}
const sign = (body, secret = SECRET, t = Math.floor(Date.now() / 1000)) =>
  `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
const evt = (id, price = 'price_pro', status = 'paid') => JSON.stringify({
  id, type: 'checkout.session.completed',
  data: { object: { id: 'cs_' + id, payment_status: status, customer: 'cus_1', subscription: 'sub_1', customer_details: { email: 'a@b.co' }, metadata: { price_id: price } } },
});
const post = (t, body, sig) => fetch(t.base + '/api/stripe/webhook', { method: 'POST', body, headers: sig ? { 'stripe-signature': sig } : {} });

test('webhook rejects bad/missing signature and issues nothing', async () => {
  const t = await start();
  const b = evt('evt_1');
  assert.equal((await post(t, b, sign(b, 'wrong'))).status, 400);
  assert.equal((await post(t, b)).status, 400);
  assert.equal((await post(t, b, sign(b, SECRET, 1000))).status, 400); // stale timestamp
  assert.equal(t.app.lw.pendingDeliveries().length, 0);
  t.close();
});

test('paid checkout issues a key that unlocks Pro; hash only at rest; delivery is human-marked', async () => {
  const t = await start();
  const b = evt('evt_2');
  assert.equal((await post(t, b, sign(b))).status, 200);
  const [d] = t.app.lw.pendingDeliveries();
  assert.ok(d && d.tier === 'pro' && d.key.startsWith('FZ-PRO-'));
  assert.equal((await fetch(t.base + '/api/lessons/git-2', { headers: { Authorization: 'Bearer ' + d.key } })).status, 200);
  assert.equal((await fetch(t.base + '/api/lessons/git-2', { headers: { Authorization: 'Bearer FZ-PRO-nope' } })).status, 402);
  const db = readFileSync(join(t.dir, 'licenses-webhook.json'), 'utf8');
  assert.ok(JSON.parse(db).licenses[d.hash], 'hash stored');
  assert.ok(!JSON.stringify(JSON.parse(db).licenses).includes(d.key), 'plaintext not in licenses');
  assert.ok(!readFileSync(join(t.dir, 'audit.jsonl'), 'utf8').includes(d.key), 'plaintext not in audit');
  assert.throws(() => t.app.lw.markDelivered(d.hash, ''), /approver/);
  t.app.lw.markDelivered(d.hash, 'owner');
  assert.equal(t.app.lw.pendingDeliveries().length, 0);
  assert.ok(!readFileSync(join(t.dir, 'licenses-webhook.json'), 'utf8').includes(d.key), 'plaintext dropped');
  assert.equal((await fetch(t.base + '/api/lessons/git-2', { headers: { Authorization: 'Bearer ' + d.key } })).status, 200);
  t.close();
});

test('replayed event id is idempotent', async () => {
  const t = await start();
  const b = evt('evt_3');
  await post(t, b, sign(b));
  const r = await (await post(t, b, sign(b))).json();
  assert.equal(r.duplicate, true);
  assert.equal(t.app.lw.pendingDeliveries().length, 1);
  t.close();
});

test('unknown price or unpaid session issues nothing', async () => {
  const t = await start();
  const a = evt('evt_4', 'price_unknown'), u = evt('evt_5', 'price_pro', 'unpaid');
  assert.equal((await post(t, a, sign(a))).status, 200);
  assert.equal((await post(t, u, sign(u))).status, 200);
  assert.equal(t.app.lw.pendingDeliveries().length, 0);
  t.close();
});

test('existing hand-issued admin keys still work alongside webhook keys', async () => {
  const t = await start();
  const k = await (await fetch(t.base + '/api/admin/keys', { method: 'POST', headers: { Authorization: 'Bearer adm' }, body: '{}' })).json();
  assert.equal((await fetch(t.base + '/api/lessons/git-2', { headers: { Authorization: 'Bearer ' + k.key } })).status, 200);
  t.close();
});
