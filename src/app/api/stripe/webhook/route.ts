import { NextResponse } from "next/server";
import { handleStripeEvent, stripe } from "@/lib/billing";

// Stripe appelle cette route après chaque paiement. La signature garantit que l'appel vient bien de Stripe.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) {
    return NextResponse.json({ error: "Webhook non configuré" }, { status: 400 });
  }

  let event;
  try {
    // Le corps doit rester brut (texte) pour que la signature soit vérifiable
    event = stripe().webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
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
