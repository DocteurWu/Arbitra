import { NextResponse } from "next/server";
import { getCurrentUser, isAuthEnabled } from "@/lib/supabase/server";
import { getCredits, isStripeEnabled } from "@/lib/billing";
import { errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

export interface MeResponse {
  authEnabled: boolean;
  stripeEnabled: boolean;
  user: { id: string; email: string } | null;
  credits: number | null;
}

export async function GET() {
  try {
    const authEnabled = isAuthEnabled();
    const user = await getCurrentUser();
    const body: MeResponse = {
      authEnabled,
      stripeEnabled: isStripeEnabled(),
      user,
      credits: user ? await getCredits(user.id) : null,
    };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
