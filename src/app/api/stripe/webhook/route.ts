import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { handleStripeEvent, stripe } from "@/lib/billing";

// Stripe appelle cette route après chaque paiement. La signature garantit que l'appel vient bien de Stripe.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) {
    return NextResponse.json({ error: "Webhook non configuré" }, { status: 400 });
  }

  // Le client est construit AVANT la vérification : sans STRIPE_SECRET_KEY il lève,
  // et ce n'est pas une signature invalide — il ne faut pas confondre les deux causes.
  let client: Stripe;
  try {
    client = stripe();
  } catch (err) {
    console.error("[stripe] client non initialisé — STRIPE_SECRET_KEY manquante ?", err);
    return NextResponse.json({ error: "Stripe non configuré" }, { status: 500 });
  }

  // Le corps doit rester brut (texte) pour que la signature soit vérifiable
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = client.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    console.error(`[stripe] signature refusée : ${(err as Error).message}`);
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  try {
    const outcome = await handleStripeEvent(event);
    console.log(`[stripe] ${event.type} ${event.id} → ${outcome}`);
    return NextResponse.json({ received: true });
  } catch (err) {
    // 500 : Stripe réessaiera automatiquement, et grant_credits est idempotent
    console.error(`[stripe] échec ${event.type} ${event.id}`, err);
    return NextResponse.json({ error: "Traitement échoué" }, { status: 500 });
  }
}
