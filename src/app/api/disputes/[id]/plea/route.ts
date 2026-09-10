import { NextResponse } from "next/server";
import { z } from "zod";
import { getDispute, savePlea } from "@/lib/storage";

const PleaSubmitSchema = z.object({
  token: z.string(),
  plea: z.object({
    summary: z.string().min(5),
    facts: z.array(z.string()).min(1),
    demand: z.string().min(3),
    concession: z.string().optional(),
  }),
});

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const body = await req.json();
    const { token, plea } = PleaSubmitSchema.parse(body);

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

    const updatedDispute = await savePlea(id, partySide, plea);

    return NextResponse.json({
      success: true,
      dispute: updatedDispute,
      status: updatedDispute.status,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
