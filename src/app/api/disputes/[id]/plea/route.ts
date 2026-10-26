import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateParty, savePlea, toPartyView } from "@/lib/storage";
import { errorResponse } from "@/lib/api";

const PleaSubmitSchema = z.object({
  token: z.string(),
  plea: z.object({
    summary: z.string().trim().min(5, "Le résumé est trop court").max(800, "Résumé trop long (800 caractères max)"),
    facts: z
      .array(z.string().trim().max(300, "Un fait ne doit pas dépasser 300 caractères"))
      .transform((facts) => facts.filter(Boolean))
      .pipe(z.array(z.string()).min(1, "Indique au moins un fait").max(8, "8 faits maximum")),
    demand: z.string().trim().min(3, "Précise ta demande").max(400, "Demande trop longue (400 caractères max)"),
    concession: z.string().trim().max(400, "Concession trop longue (400 caractères max)").optional(),
  }),
});

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const { token, plea } = PleaSubmitSchema.parse(await req.json());
    const { side } = await authenticateParty(id, token);

    const updated = await savePlea(id, side, plea);

    return NextResponse.json({
      success: true,
      status: updated.status,
      view: toPartyView(updated, side),
    });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
