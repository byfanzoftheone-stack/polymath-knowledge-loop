import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const REDACT = /(key|token|secret|password|authorization)/i;
export function redact(obj) {
  if (Array.isArray(obj)) return obj.map(redact);
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, REDACT.test(k) ? '[REDACTED]' : redact(v)]));
  return obj;
}

// Append-only JSONL audit log. Secrets are redacted by key name.
export function makeAudit(dataDir) {
  mkdirSync(dataDir, { recursive: true });
  const file = join(dataDir, 'audit.jsonl');
  return (event, detail = {}) => {
    appendFileSync(file, JSON.stringify({ ts: new Date().toISOString(), event, detail: redact(detail) }) + '\n');
  };
}
