import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/supabase/server";
import { createCheckoutUrl, isStripeEnabled } from "@/lib/billing";
import { isPlanId } from "@/lib/plans";
import { errorResponse } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";

const Schema = z.object({ plan: z.string().refine(isPlanId, "Offre inconnue") });

export async function POST(req: Request) {
  try {
    const { plan } = Schema.parse(await req.json());
    if (!isStripeEnabled()) {
      return NextResponse.json({ error: "Le paiement n'est pas encore configuré." }, { status: 503 });
    }

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Connecte-toi pour acheter.", code: "auth_required" }, { status: 401 });

    const limited = rateLimit(`checkout:${user.id}`, 10, 10 * 60_000);
    if (limited) return limited;

    const url = await createCheckoutUrl(user, plan as Parameters<typeof createCheckoutUrl>[1], new URL(req.url).origin);
    return NextResponse.json({ url });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
