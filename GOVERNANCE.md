# Governance

## Principles
No spend, publishing, or outbound communication happens without explicit human approval. Everything sensitive is logged.

## Guardrails (implemented)
| Guardrail | Where | Behavior |
|---|---|---|
| Human approval | `src/approvals.js`, `src/cli.js` | `spend`, `publish`, `outbound` actions are queued as pending; only `node src/cli.js approve <id>` (a human) approves. |
| Live payments off by default | `src/checkout.js` | Stripe is called only if key, price AND `LIVE_PAYMENTS_APPROVED=yes` are all set; otherwise stub with no network call. |
| Audit log | `src/audit.js` | Append-only `data/audit.jsonl`; values under key/token/secret/password/authorization fields are redacted; waitlist emails are not logged. |
| No secrets in code | `src/config.js`, `.env.example`, `.gitignore` | All secrets come from env; `.env` is git-ignored; license keys stored only as HMAC hashes. |
| Rate limits | `src/ratelimit.js` | Per-IP fixed window (`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`), returns 429, logged. |
| Admin auth | `src/app.js` | Key issuance requires `ADMIN_TOKEN` (constant-time compare). |

## Known limits
Rate limiter is in-memory and per-process; behind a proxy, client IP needs trusted-proxy handling. JSON storage is not concurrency-safe at scale. Approval queue is a gate for callers to use; no automated sender exists in this repo.

## Owner responsibilities
Rotate secrets if exposed, review `audit.jsonl`, approve pricing, and handle privacy requests for the waitlist file.
