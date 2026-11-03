// Sonde de diagnostic : crée une session Checkout avec les mêmes paramètres que src/lib/billing.ts
// Sert à vérifier que Stripe accepte les paramètres Checkout Studio et que les Price IDs sont bons.
const fs = require("fs");
const Stripe = require("stripe");

const env = {};
for (const line of fs.readFileSync("/home/dietpi/Arbitra/.env.local", "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i > 0 && !line.startsWith("#")) env[line.slice(0, i)] = line.slice(i + 1);
}
const stripe = new Stripe(env.STRIPE_SECRET_KEY);

const PLANS = {
  single: { amount: 199, price: env.STRIPE_PRICE_SINGLE, kind: "payment" },
  monthly: { amount: 699, price: env.STRIPE_PRICE_MONTHLY, kind: "subscription" },
};

(async () => {
  for (const [plan, p] of Object.entries(PLANS)) {
    const mode = p.kind;
    const params = {
      ui_mode: "hosted_page",
      origin_context: "web",
      integration_identifier: "hosted_web_0001",
      billing_address_collection: "auto",
      phone_number_collection: { enabled: false },
      automatic_tax: { enabled: false },
      submit_type: "auto",
      allow_promotion_codes: true,
      ...(mode === "subscription" ? { payment_method_collection: "always" } : {}),
      mode,
      line_items: [{ quantity: 1, price: p.price }],
      metadata: { user_id: "diag-sonde", plan },
      ...(mode === "subscription" ? { subscription_data: { metadata: { user_id: "diag-sonde", plan } } } : {}),
      success_url: "https://arbitra.24dw24.duckdns.org/pricing?paid=1&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://arbitra.24dw24.duckdns.org/pricing?canceled=1",
    };
    try {
      const s = await stripe.checkout.sessions.create(params);
      console.log(`OK ${plan} | ${s.id} | mode=${s.mode} | ui_mode=${s.ui_mode} | tax_auto=${s.automatic_tax?.enabled} | pmc=${s.payment_method_collection} | amount=${s.amount_total} ${s.currency}`);
      console.log(`   url=${s.url}`);
      await stripe.checkout.sessions.expire(s.id);
      console.log(`   (session expirée pour ne pas polluer le dashboard)`);
    } catch (e) {
      console.log(`ECHEC ${plan} : ${e.type} — ${e.message}`);
    }
  }
})();
