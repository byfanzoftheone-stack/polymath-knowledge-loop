import { buildApp } from './app.js';
import { loadConfig } from './config.js';
const cfg = loadConfig();
if (!cfg.licenseSecret) console.warn('WARN: LICENSE_HASH_SECRET unset; Pro keys cannot be issued/verified.');
buildApp(cfg).server.listen(cfg.port, () => console.log(`listening on :${cfg.port} (payments: ${cfg.stripeKey && cfg.livePaymentsApproved ? 'LIVE' : 'stub'})`));
