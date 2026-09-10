import { NextResponse } from "next/server";
import { getDispute, saveVerdict } from "@/lib/storage";
import { askJudge } from "@/lib/llm";

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const dispute = await getDispute(id);

    if (!dispute) {
      return NextResponse.json({ error: "Dispute non trouvée" }, { status: 404 });
    }

    if (dispute.verdict) {
      return NextResponse.json({ verdict: dispute.verdict, dispute });
    }

    if (!dispute.parties.A.plea || !dispute.parties.B.plea) {
      return NextResponse.json(
        { error: "Les deux plaidoiries doivent être soumises avant l'arbitrage" },
        { status: 400 }
      );
    }

    const verdict = await askJudge(
      dispute.topic,
      dispute.gage,
      {
        name: dispute.parties.A.name,
        plea: dispute.parties.A.plea,
        rebuttal: dispute.parties.A.rebuttal,
      },
      {
        name: dispute.parties.B.name,
        plea: dispute.parties.B.plea,
        rebuttal: dispute.parties.B.rebuttal,
      }
    );

    const updatedDispute = await saveVerdict(id, verdict);
    return NextResponse.json({ verdict, dispute: updatedDispute });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
