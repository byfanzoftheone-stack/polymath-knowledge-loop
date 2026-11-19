import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { timingSafeEqual } from 'node:crypto';
import { loadConfig } from './config.js';
import { makeAudit } from './audit.js';
import { makeLimiter } from './ratelimit.js';
import { makeStore } from './store.js';
import { issueKey, verifyKey } from './licenses.js';
import { createCheckout } from './checkout.js';
import { makeLicenseWebhook } from './webhook.js';

const lessons = JSON.parse(readFileSync(new URL('../content/lessons.json', import.meta.url), 'utf8'));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const safeEq = (a, b) => a.length === b.length && a.length > 0 && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function buildApp(cfg = loadConfig()) {
  const audit = makeAudit(cfg.dataDir);
  const store = makeStore(cfg.dataDir);
  const limit = makeLimiter(cfg.rateMax, cfg.rateWindowMs);
  const lw = makeLicenseWebhook(cfg, audit);
  const proLicensed = (key) => verifyKey(store, cfg.licenseSecret, key) || ['pro', 'team'].includes(lw.validate(key).tier);
  // Raw bytes (NOT parsed): Stripe signs the exact body.
  const readRaw = (req, max = 1_000_000) => new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > max) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

  const send = (res, code, body, type = 'application/json') => {
    res.writeHead(code, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' });
    res.end(type === 'application/json' ? JSON.stringify(body) : body);
  };
  const readJson = (req) => new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 10_000) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); } });
  });
  const bearer = (req) => (req.headers.authorization || '').replace(/^Bearer /, '');

  const page = () => `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Polymath Knowledge Loop</title>
<body style="font-family:system-ui;max-width:42rem;margin:2rem auto;padding:0 1rem">
<h1>Polymath Knowledge Loop</h1><p>A learning loop for Git, coding skills, and terminal relay.</p>
<h2>Pricing (placeholder, pending owner approval)</h2>
<ul><li><b>Free</b> - $0: ${lessons.filter((l) => l.tier === 'free').length} starter lessons</li>
<li><b>Pro</b> - $${esc(cfg.priceUsd)}/mo: all ${lessons.length} lessons via license key</li></ul>
<form method=post action=/api/checkout onsubmit="event.preventDefault();fetch('/api/checkout',{method:'POST',body:JSON.stringify({email:this.email.value})}).then(r=>r.json()).then(j=>alert(j.message||j.url))"><input name=email type=email placeholder=email required> <button>Get Pro</button></form>
<form onsubmit="event.preventDefault();fetch('/api/waitlist',{method:'POST',body:JSON.stringify({email:this.email.value})}).then(r=>r.json()).then(j=>alert(j.ok?'Added':'Error'))"><input name=email type=email placeholder=email required> <button>Join waitlist</button></form>
<p>Free lessons: <a href=/api/lessons>/api/lessons</a></p></body>`;

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const ip = req.socket.remoteAddress || 'unknown';
    if (!limit(ip)) { audit('ratelimit.block', { ip, path: url.pathname }); return send(res, 429, { error: 'rate limited' }); }
    try {
      if (req.method === 'GET' && url.pathname === '/') return send(res, 200, page(), 'text/html; charset=utf-8');
      if (req.method === 'GET' && url.pathname === '/healthz') return send(res, 200, { ok: true });
      if (req.method === 'GET' && url.pathname === '/api/lessons')
        return send(res, 200, lessons.map(({ id, tier, title }) => ({ id, tier, title })));
      const m = url.pathname.match(/^\/api\/lessons\/([\w-]+)$/);
      if (req.method === 'GET' && m) {
        const l = lessons.find((x) => x.id === m[1]);
        if (!l) return send(res, 404, { error: 'not found' });
        if (l.tier === 'pro' && !proLicensed(bearer(req))) {
          audit('lesson.denied', { id: l.id, ip });
          return send(res, 402, { error: 'Pro license key required', upgrade: '/' });
        }
        return send(res, 200, l);
      }
      if (req.method === 'POST' && url.pathname === '/api/waitlist') {
        const { email } = await readJson(req);
        if (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200)
          return send(res, 400, { error: 'invalid email' });
        const list = store.read('waitlist', []);
        if (!list.includes(email)) { list.push(email); store.write('waitlist', list); }
        audit('waitlist.add', { count: list.length }); // no PII in log
        return send(res, 200, { ok: true });
      }
      if (req.method === 'POST' && url.pathname === '/api/checkout') {
        const { email } = await readJson(req);
        return send(res, 200, await createCheckout(cfg, audit, typeof email === 'string' ? email.slice(0, 200) : ''));
      }
      if (req.method === 'POST' && url.pathname === '/api/stripe/webhook') {
        let raw;
        try { raw = await readRaw(req); } catch { return send(res, 413, { error: 'too large' }); }
        const out = lw.handle(raw, req.headers['stripe-signature']);
        return send(res, out.status, out.body);
      }
      if (req.method === 'POST' && url.pathname === '/api/admin/keys') {
        if (!cfg.adminToken || !safeEq(bearer(req), cfg.adminToken)) { audit('admin.denied', { ip }); return send(res, 401, { error: 'unauthorized' }); }
        const { label } = await readJson(req);
        const key = issueKey(store, cfg.licenseSecret, String(label || '').slice(0, 80));
        audit('license.issued', { label });
        return send(res, 200, { key, note: 'shown once' });
      }
      send(res, 404, { error: 'not found' });
    } catch (e) {
      audit('error', { message: e.message });
      send(res, 500, { error: 'internal error' });
    }
  });
  return { server, store, audit, lw };
}
