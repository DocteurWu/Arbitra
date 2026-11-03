import Stripe from "stripe";
import { adminClient, CurrentUser } from "@/lib/supabase/server";
import { CURRENCY, PLANS, PlanId, isPlanId, stripePriceId } from "@/lib/plans";

// --- Crédits ---

export async function getCredits(userId: string): Promise<number> {
  const { data, error } = await adminClient().from("profiles").select("credits").eq("id", userId).maybeSingle();
  if (error) throw new Error(`Lecture du solde impossible : ${error.message}`);
  return data?.credits ?? 0;
}

/** Débite un crédit de façon atomique. false si le solde est insuffisant. */
export async function consumeCredit(userId: string, ref: string): Promise<boolean> {
  const { data, error } = await adminClient().rpc("consume_credit", { p_user: userId, p_ref: ref });
  if (error) throw new Error(`Débit du crédit impossible : ${error.message}`);
  return data === true;
}

/** Ajoute des crédits. Idempotent : rejouer le même `ref` ne crédite qu'une fois. */
export async function grantCredits(userId: string, amount: number, reason: string, ref: string): Promise<boolean> {
  const { data, error } = await adminClient().rpc("grant_credits", {
    p_user: userId,
    p_amount: amount,
    p_reason: reason,
    p_ref: ref,
  });
  if (error) throw new Error(`Crédit du compte impossible : ${error.message}`);
  return data === true;
}

// --- Stripe ---

export function isStripeEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

let stripeClient: Stripe | null = null;
export function stripe(): Stripe {
  if (!stripeClient) stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return stripeClient;
}

async function ensureCustomer(user: CurrentUser): Promise<string> {
  const db = adminClient();
  const { data } = await db.from("profiles").select("stripe_customer_id").eq("id", user.id).maybeSingle();
  if (data?.stripe_customer_id) return data.stripe_customer_id;

  const customer = await stripe().customers.create({ email: user.email, metadata: { user_id: user.id } });
  await db.from("profiles").update({ stripe_customer_id: customer.id }).eq("id", user.id);
  return customer.id;
}

export async function createCheckoutUrl(user: CurrentUser, planId: PlanId, origin: string): Promise<string> {
  const plan = PLANS[planId];
  const customer = await ensureCustomer(user);
  const metadata = { user_id: user.id, plan: plan.id };
  const priceId = stripePriceId(plan.id);

  // Catalogue Stripe si un Price ID est configuré, sinon prix à la volée (aucune config dashboard).
  const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = priceId
    ? { quantity: 1, price: priceId }
    : {
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: plan.amountCents,
          product_data: { name: `L'Arbitre — ${plan.name}`, description: plan.description },
          ...(plan.kind === "subscription" ? { recurring: { interval: "month" as const } } : {}),
        },
      };

  const mode = plan.kind === "subscription" ? "subscription" : "payment";

  const session = await stripe().checkout.sessions.create({
    // Paramètres configurés dans Checkout Studio (Stripe Dashboard) — ne pas éditer à la main.
    ui_mode: "hosted_page",
    origin_context: "web",
    integration_identifier: "hosted_web_0001",
    billing_address_collection: "auto",
    phone_number_collection: { enabled: false },
    automatic_tax: { enabled: false },
    submit_type: "auto",
    allow_promotion_codes: true,
    // `payment_method_collection` ne vaut que pour les abonnements (mode subscription).
    ...(mode === "subscription" ? { payment_method_collection: "always" as const } : {}),

    // Câblage applicatif : identifie l'utilisateur pour créditer le bon compte au webhook.
    mode,
    customer,
    client_reference_id: user.id,
    line_items: [lineItem],
    metadata,
    ...(mode === "subscription" ? { subscription_data: { metadata } } : {}),
    success_url: `${origin}/pricing?paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing?canceled=1`,
  });

  if (!session.url) throw new Error("Stripe n'a pas renvoyé d'URL de paiement");
  return session.url;
}

export async function createPortalUrl(user: CurrentUser, origin: string): Promise<string> {
  const customer = await ensureCustomer(user);
  const session = await stripe().billingPortal.sessions.create({ customer, return_url: `${origin}/pricing` });
  return session.url;
}

// --- Webhook : transforme les événements Stripe en crédits ---

function planFromMetadata(metadata: Stripe.Metadata | null | undefined) {
  const userId = metadata?.user_id;
  const planId = metadata?.plan;
  if (!userId || !isPlanId(planId)) return null;
  return { userId, plan: PLANS[planId] };
}

export async function handleStripeEvent(event: Stripe.Event): Promise<string> {
  switch (event.type) {
    // Paiement unique (packs). Les abonnements sont crédités à la facture.
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "payment" || session.payment_status !== "paid") return "ignoré";
      const found = planFromMetadata(session.metadata);
      if (!found) return "métadonnées manquantes";
      const granted = await grantCredits(found.userId, found.plan.credits, "purchase_pack", `cs:${session.id}`);
      return granted ? `+${found.plan.credits} crédits (pack)` : "déjà traité";
    }

    // Abonnement : première facture et renouvellements mensuels.
    // On remonte l'objet Subscription (graphe d'objets Stripe) au lieu de lire des
    // métadonnées recopiées sur la facture : c'est la source fiable, quel que soit
    // le mode de facturation, et ça survit aux changements de version d'API.
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const ref = invoice.parent?.subscription_details?.subscription;
      const subscriptionId = typeof ref === "string" ? ref : ref?.id;
      if (!subscriptionId) return "ignoré";
      const subscription = await stripe().subscriptions.retrieve(subscriptionId);
      const found = planFromMetadata(subscription.metadata);
      if (!found) return "métadonnées manquantes";
      const granted = await grantCredits(found.userId, found.plan.credits, "subscription", `inv:${invoice.id}`);
      return granted ? `+${found.plan.credits} crédits (abonnement)` : "déjà traité";
    }

    // Paiement différé échoué (SEPA, prélèvement…) : rien n'a été crédité, rien à reprendre.
    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      return `paiement différé échoué (${session.id})`;
    }

    // Échec de renouvellement : Stripe relance tout seul (Smart Retries), on trace.
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      return `renouvellement échoué (${invoice.id})`;
    }

    // Fin d'abonnement : les crédits déjà accordés restent acquis (modèle à crédits).
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      return `abonnement résilié (${sub.id})`;
    }

    // Politique produit retenue : les crédits achetés sont CONSERVÉS même après remboursement.
    // On se contente de tracer l'événement (visibilité comptable + repérage d'abus).
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const montant = (charge.amount_refunded ?? 0) / 100;
      return `remboursement ${montant.toFixed(2)} € — crédits conservés (politique choisie)`;
    }

    // Signaux risque : on trace pour pouvoir agir manuellement (aucune action automatique).
    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      return `LITIGE BANCAIRE ouvert (${dispute.id}) — action manuelle requise`;
    }
    case "radar.early_fraud_warning.created": {
      const warning = event.data.object as Stripe.Radar.EarlyFraudWarning;
      return `alerte fraude Radar (${warning.id}) — à vérifier`;
    }

    default:
      return "ignoré";
  }
}
