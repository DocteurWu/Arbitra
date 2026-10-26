import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { createPortalUrl, isStripeEnabled } from "@/lib/billing";
import { errorResponse } from "@/lib/api";

// Portail Stripe : gérer / résilier l'abonnement, voir les factures
export async function POST(req: Request) {
  try {
    if (!isStripeEnabled()) {
      return NextResponse.json({ error: "Le paiement n'est pas encore configuré." }, { status: 503 });
    }
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Connecte-toi d'abord.", code: "auth_required" }, { status: 401 });

    return NextResponse.json({ url: await createPortalUrl(user, new URL(req.url).origin) });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
