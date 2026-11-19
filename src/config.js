// Config comes only from environment variables. No secrets live in code.
export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT || 3000),
    dataDir: env.DATA_DIR || 'data',
    licenseSecret: env.LICENSE_HASH_SECRET || '',
    adminToken: env.ADMIN_TOKEN || '',
    stripeKey: env.STRIPE_SECRET_KEY || '',
    stripePrice: env.STRIPE_PRICE_PRO || env.STRIPE_PRICE_ID_PRO || '',
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
    // price id -> tier, from env only. Unknown prices issue nothing.
    priceTiers: Object.fromEntries([
      [env.STRIPE_PRICE_PRO || env.STRIPE_PRICE_ID_PRO, 'pro'],
      [env.STRIPE_PRICE_TEAM, 'team'],
    ].filter(([id]) => id)),
    licenseDb: env.LICENSE_DB || '',
    livePaymentsApproved: env.LIVE_PAYMENTS_APPROVED === 'yes',
    baseUrl: env.PUBLIC_BASE_URL || 'http://localhost:3000',
    rateMax: Number(env.RATE_LIMIT_MAX || 60),
    rateWindowMs: Number(env.RATE_LIMIT_WINDOW_MS || 60000),
    priceUsd: env.PRO_PRICE_USD || '12',
  };
}
