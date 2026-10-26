import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateParty, saveRebuttal, toPartyView } from "@/lib/storage";
import { runJudgement } from "@/lib/arbitration";
import { errorResponse } from "@/lib/api";
import { REBUTTAL_MAX_LENGTH } from "@/lib/limits";

const RebuttalSchema = z.object({
  token: z.string(),
  rebuttal: z
    .string()
    .trim()
    .min(1, "La réplique ne peut être vide")
    .max(REBUTTAL_MAX_LENGTH, `${REBUTTAL_MAX_LENGTH} caractères maximum`),
});

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const { token, rebuttal } = RebuttalSchema.parse(await req.json());
    const { side } = await authenticateParty(id, token);

    let dispute = await saveRebuttal(id, side, rebuttal);

    // Les deux répliques sont là : l'arbitre délibère immédiatement
    if (dispute.status === "judging") {
      dispute = await runJudgement(id);
    }

    return NextResponse.json({
      success: true,
      verdictReady: !!dispute.verdict,
      view: toPartyView(dispute, side),
    });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
