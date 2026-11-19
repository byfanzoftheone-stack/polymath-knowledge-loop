// Checkout: stub by default. Live Stripe session creation requires BOTH
// STRIPE_SECRET_KEY and LIVE_PAYMENTS_APPROVED=yes. Never exercised in tests.
export async function createCheckout(cfg, audit, email) {
  const live = cfg.stripeKey && cfg.stripePrice && cfg.livePaymentsApproved;
  if (!live) {
    audit('checkout.stub', { email });
    return { mode: 'stub', message: 'Payments are not enabled yet. You have been noted; the owner must configure Stripe and approve live payments.' };
  }
  const body = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': cfg.stripePrice,
    'line_items[0][quantity]': '1',
    // Lets the webhook map the paid session to a tier (server-side map only).
    'metadata[price_id]': cfg.stripePrice,
    success_url: cfg.baseUrl + '/?paid=1',
    cancel_url: cfg.baseUrl + '/?canceled=1',
    ...(email ? { customer_email: email } : {}),
  });
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + cfg.stripeKey, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const j = await r.json();
  audit('checkout.live', { status: r.status, session: j.id });
  if (!r.ok) throw new Error('stripe error');
  return { mode: 'live', url: j.url };
}
