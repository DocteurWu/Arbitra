import { NextResponse } from "next/server";
import { getDispute } from "@/lib/storage";
import { getCurrentUser } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api";

// Liens privés des deux parties : réservés au compte qui a ouvert le litige
export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const [dispute, user] = await Promise.all([getDispute(id), getCurrentUser()]);

    if (!dispute || !user || dispute.ownerId !== user.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    return NextResponse.json({ tokenA: dispute.parties.A.token, tokenB: dispute.parties.B.token });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
