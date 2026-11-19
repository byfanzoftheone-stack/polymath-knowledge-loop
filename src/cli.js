// Human approval CLI: node src/cli.js list | approve <id> | reject <id>
import { loadConfig } from './config.js';
import { makeStore } from './store.js';
import { makeAudit } from './audit.js';
import { decide } from './approvals.js';
const cfg = loadConfig();
const store = makeStore(cfg.dataDir), audit = makeAudit(cfg.dataDir);
const [cmd, id] = process.argv.slice(2);
if (cmd === 'list') console.log(JSON.stringify(store.read('approvals', []).filter((i) => i.status === 'pending'), null, 2));
else if (cmd === 'approve' || cmd === 'reject') console.log(decide(store, audit, id, cmd === 'approve', process.env.USER || 'cli'));
else console.log('usage: list | approve <id> | reject <id>');
