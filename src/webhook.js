import { join } from 'node:path';
import { createLicenseWebhook, JsonStore } from './license-webhook.mjs';

// Wires the vendored shared module to this app's config + audit log.
// The module only verifies, records and queues; it never emails or calls Stripe.
export function makeLicenseWebhook(cfg, audit) {
  return createLicenseWebhook({
    secret: cfg.stripeWebhookSecret,
    priceTiers: cfg.priceTiers,
    store: new JsonStore(cfg.licenseDb || join(cfg.dataDir, 'licenses-webhook.json')),
    audit: (r) => { const { type, ...rest } = r; audit('license_webhook.' + type, rest); },
  });
}
