import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateParty, addMessage, getDispute, getMessagesForParty, toPartyView } from "@/lib/storage";
import { askCoach } from "@/lib/llm";
import { errorResponse } from "@/lib/api";

const CoachRequestSchema = z.object({
  token: z.string(),
  message: z
    .string()
    .trim()
    .min(1, "Le message ne peut être vide")
    .max(2000, "Message trop long (2000 caractères max)"),
  finalize: z.boolean().optional(),
});

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const { token, message, finalize } = CoachRequestSchema.parse(await req.json());
    const { dispute, side } = await authenticateParty(id, token);

    if (dispute.parties[side].plea) {
      return NextResponse.json({ error: "Ta plaidoirie est déjà déposée." }, { status: 409 });
    }

    const history = await getMessagesForParty(id, side);

    // Appel LLM avant d'enregistrer : en cas d'échec, l'utilisateur peut renvoyer
    // son message sans laisser de message orphelin dans l'historique
    const coachResponse = await askCoach({
      topic: dispute.topic,
      partySide: side,
      partyName: dispute.parties[side].name,
      opponentName: dispute.parties[side === "A" ? "B" : "A"].name,
      history,
      userMessage: message,
      finalize,
    });

    await addMessage(id, side, "user", message);
    await addMessage(id, side, "coach", coachResponse.message);

    const updated = await getDispute(id);
    return NextResponse.json({
      extractedPlea: coachResponse.extractedPlea || null,
      view: toPartyView(updated!, side),
    });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
