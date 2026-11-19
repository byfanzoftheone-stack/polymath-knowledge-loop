# Monetization Plan

## What the product is
Polymath Knowledge Loop: a curriculum and learning loop (write, break, explain, teach back) for Git, coding skills, terminal relay and agentic workflows. Free starter lessons; Pro lessons gated by a license key (`src/licenses.js`).

## Who pays
- Self-taught developers and career switchers who want structured Git/terminal depth.
- Bootcamps and team leads onboarding junior engineers.
- Builders adopting AI agents who need a delegation-with-checkpoints playbook.

## Pricing tiers (PLACEHOLDERS - owner must approve before any use)
| Tier | Price | Includes |
|---|---|---|
| Free | $0 | Starter lessons, waitlist access |
| Pro | $12/mo (`PRO_PRICE_USD`) | All lessons, license key, updates |
| Team | $99/mo (not implemented) | 10 seats, shared progress, priority support |

## Revenue paths
1. Pro subscriptions through Stripe Checkout (stub in `src/checkout.js`).
2. Annual/lifetime license keys issued via `POST /api/admin/keys` for direct sales.
3. Team/bootcamp licenses and workshops.
4. Paid cohort or course bundles built from the lesson content.
5. Sponsorship of the free tier (owner-approved, disclosed).

## Launch checklist
- [ ] Owner approves pricing and refund policy
- [ ] Create Stripe product/price; set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID_PRO` in the host's secret store (not git)
- [ ] Add a Stripe webhook that issues a key after payment (not yet built)
- [ ] Set `LICENSE_HASH_SECRET`, `ADMIN_TOKEN`; set `LIVE_PAYMENTS_APPROVED=yes` only after a test-mode purchase works
- [ ] Add Terms, Privacy, and tax setup; add persistent storage (JSON files are for MVP only)
- [ ] Choose host and deploy (owner action); put TLS in front
- [ ] Review and approve `LAUNCH.md` copy, then post manually
