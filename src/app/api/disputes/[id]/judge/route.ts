import { NextResponse } from "next/server";
import { getDispute, toPublicDispute } from "@/lib/storage";
import { runJudgement } from "@/lib/arbitration";
import { errorResponse } from "@/lib/api";

// Relance de l'arbitrage (après une erreur du juge, par exemple)
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const dispute = await getDispute(id);

    if (!dispute) {
      return NextResponse.json({ error: "Litige introuvable" }, { status: 404 });
    }

    if (!dispute.verdict && dispute.status !== "judging") {
      return NextResponse.json(
        { error: "Les deux plaidoiries et les deux répliques doivent être déposées avant l'arbitrage" },
        { status: 409 }
      );
    }

    const judged = await runJudgement(id);
    if (!judged.verdict) {
      return NextResponse.json(
        { error: judged.verdictError || "L'arbitrage a échoué", dispute: toPublicDispute(judged) },
        { status: 502 }
      );
    }

    return NextResponse.json({ verdict: judged.verdict, dispute: toPublicDispute(judged) });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
