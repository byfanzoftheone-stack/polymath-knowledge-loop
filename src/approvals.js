import { randomUUID } from 'node:crypto';

// Human-in-the-loop gate. Spend / publish / outbound actions are QUEUED as
// pending; nothing executes until a human approves via the CLI (src/cli.js).
export const SENSITIVE = new Set(['spend', 'publish', 'outbound']);

export function requestApproval(store, audit, kind, payload) {
  if (!SENSITIVE.has(kind)) throw new Error('unknown action kind: ' + kind);
  const item = { id: randomUUID(), kind, payload, status: 'pending', created: new Date().toISOString() };
  const q = store.read('approvals', []);
  q.push(item);
  store.write('approvals', q);
  audit('approval.requested', { id: item.id, kind });
  return item;
}

export function decide(store, audit, id, approve, who = 'cli') {
  const q = store.read('approvals', []);
  const item = q.find((i) => i.id === id);
  if (!item || item.status !== 'pending') throw new Error('no pending approval ' + id);
  item.status = approve ? 'approved' : 'rejected';
  item.decidedBy = who;
  item.decided = new Date().toISOString();
  store.write('approvals', q);
  audit('approval.' + item.status, { id, kind: item.kind, who });
  return item;
}

export const isApproved = (store, id) => store.read('approvals', []).some((i) => i.id === id && i.status === 'approved');
