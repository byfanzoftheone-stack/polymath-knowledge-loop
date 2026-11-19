// Human approval CLI: node src/cli.js list | approve <id> | reject <id> | deliveries | delivered <hash> <approver>
import { loadConfig } from './config.js';
import { makeStore } from './store.js';
import { makeAudit } from './audit.js';
import { decide } from './approvals.js';
import { makeLicenseWebhook } from './webhook.js';
const cfg = loadConfig();
const store = makeStore(cfg.dataDir), audit = makeAudit(cfg.dataDir);
const [cmd, id, approver] = process.argv.slice(2);
if (cmd === 'list') console.log(JSON.stringify(store.read('approvals', []).filter((i) => i.status === 'pending'), null, 2));
else if (cmd === 'approve' || cmd === 'reject') console.log(decide(store, audit, id, cmd === 'approve', process.env.USER || 'cli'));
else if (cmd === 'deliveries') {
  // Plaintext keys: protect this output. Deliver by hand; this CLI never emails or calls Stripe.
  console.error('WARNING: output contains plaintext license keys. Do not paste into logs or chat.');
  console.log(JSON.stringify(makeLicenseWebhook(cfg, audit).pendingDeliveries(), null, 2));
} else if (cmd === 'delivered') {
  if (!id || !approver) { console.error('usage: delivered <hash> <approver>'); process.exit(1); }
  try { makeLicenseWebhook(cfg, audit).markDelivered(id, approver); console.log('marked delivered (plaintext dropped) by ' + approver); }
  catch (e) { console.error(e.message); process.exit(1); }
} else console.log('usage: list | approve <id> | reject <id> | deliveries | delivered <hash> <approver>');
