import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateParty, addExchange, getMessagesForParty, messagesLeft, toPartyView } from "@/lib/storage";
import { askCoach } from "@/lib/llm";
import { errorResponse } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { COACH_MESSAGE_MAX_LENGTH } from "@/lib/limits";

const CoachRequestSchema = z.object({
  token: z.string(),
  message: z
    .string()
    .trim()
    .min(1, "Le message ne peut être vide")
    .max(COACH_MESSAGE_MAX_LENGTH, `Message trop long (${COACH_MESSAGE_MAX_LENGTH} caractères max)`),
  finalize: z.boolean().optional(),
});

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const { token, message, finalize } = CoachRequestSchema.parse(await req.json());
    const { dispute, side } = await authenticateParty(id, token);

    // Garde-fou de coût : 20 messages par minute et par lien privé
    const limited = rateLimit(`coach:${token}`, 20, 60_000);
    if (limited) return limited;

    if (dispute.parties[side].plea) {
      return NextResponse.json({ error: "Ta plaidoirie est déjà déposée." }, { status: 409 });
    }
    if (messagesLeft(dispute, side) <= 0) {
      return NextResponse.json(
        { error: "Tu as utilisé tous tes messages pour ce litige. Génère ta fiche et dépose ta plaidoirie." },
        { status: 429 }
      );
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

    const updated = await addExchange(id, side, message, coachResponse.message);
    return NextResponse.json({
      extractedPlea: coachResponse.extractedPlea || null,
      view: toPartyView(updated, side),
    });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
