import Stripe from "stripe";
import { adminClient, CurrentUser } from "@/lib/supabase/server";
import { CURRENCY, PLANS, PlanId, isPlanId } from "@/lib/plans";

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

  const session = await stripe().checkout.sessions.create({
    mode: plan.kind === "subscription" ? "subscription" : "payment",
    customer,
    client_reference_id: user.id,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: plan.amountCents,
          product_data: { name: `L'Arbitre — ${plan.name}`, description: plan.description },
          ...(plan.kind === "subscription" ? { recurring: { interval: "month" as const } } : {}),
        },
      },
    ],
    metadata,
    ...(plan.kind === "subscription" ? { subscription_data: { metadata } } : {}),
    success_url: `${origin}/pricing?paid=1`,
    cancel_url: `${origin}/pricing?canceled=1`,
    allow_promotion_codes: true,
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

    // Abonnement : première facture et renouvellements mensuels
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const details = invoice.parent?.subscription_details;
      if (!details) return "ignoré";
      const found = planFromMetadata(details.metadata);
      if (!found) return "métadonnées manquantes";
      const granted = await grantCredits(found.userId, found.plan.credits, "subscription", `inv:${invoice.id}`);
      return granted ? `+${found.plan.credits} crédits (abonnement)` : "déjà traité";
    }

    default:
      return "ignoré";
  }
}
