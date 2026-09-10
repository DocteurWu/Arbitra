import { NextResponse } from "next/server";
import { z } from "zod";
import { getDispute, saveRebuttal, saveVerdict } from "@/lib/storage";
import { askJudge } from "@/lib/llm";

const RebuttalSchema = z.object({
  token: z.string(),
  rebuttal: z
    .string()
    .min(1, "La réplique ne peut être vide")
    .max(600, "600 caractères maximum"),
});

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const body = await req.json();
    const { token, rebuttal } = RebuttalSchema.parse(body);

    const dispute = await getDispute(id);
    if (!dispute) {
      return NextResponse.json({ error: "Dispute non trouvée" }, { status: 404 });
    }

    const partySide =
      dispute.parties.A.token === token
        ? "A"
        : dispute.parties.B.token === token
        ? "B"
        : null;

    if (!partySide) {
      return NextResponse.json({ error: "Token invalide" }, { status: 403 });
    }

    const updatedDispute = await saveRebuttal(id, partySide, rebuttal);

    // Si les deux répliques sont présentes, déclencher l'arbitrage
    if (
      updatedDispute.parties.A.rebuttal &&
      updatedDispute.parties.B.rebuttal &&
      updatedDispute.parties.A.plea &&
      updatedDispute.parties.B.plea &&
      !updatedDispute.verdict
    ) {
      try {
        const verdict = await askJudge(
          updatedDispute.topic,
          updatedDispute.gage,
          {
            name: updatedDispute.parties.A.name,
            plea: updatedDispute.parties.A.plea,
            rebuttal: updatedDispute.parties.A.rebuttal,
          },
          {
            name: updatedDispute.parties.B.name,
            plea: updatedDispute.parties.B.plea,
            rebuttal: updatedDispute.parties.B.rebuttal,
          }
        );
        const resolvedDispute = await saveVerdict(id, verdict);
        return NextResponse.json({
          success: true,
          dispute: resolvedDispute,
          verdictReady: true,
        });
      } catch (judgeErr) {
        console.error("Erreur lors de l'arbitrage:", judgeErr);
      }
    }

    return NextResponse.json({
      success: true,
      dispute: updatedDispute,
      verdictReady: !!updatedDispute.verdict,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
