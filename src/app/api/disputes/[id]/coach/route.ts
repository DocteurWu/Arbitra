import { NextResponse } from "next/server";
import { z } from "zod";
import { getDispute, addMessage, getMessagesForParty } from "@/lib/storage";
import { askCoach } from "@/lib/llm";

const CoachRequestSchema = z.object({
  token: z.string(),
  message: z.string().min(1, "Le message ne peut être vide"),
});

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const body = await req.json();
    const { token, message } = CoachRequestSchema.parse(body);

    const dispute = await getDispute(id);
    if (!dispute) {
      return NextResponse.json({ error: "Dispute non trouvée" }, { status: 404 });
    }

    // Authentifier la partie via son token
    const partySide =
      dispute.parties.A.token === token
        ? "A"
        : dispute.parties.B.token === token
        ? "B"
        : null;

    if (!partySide) {
      return NextResponse.json({ error: "Token invalide" }, { status: 403 });
    }

    // 1. Ajouter le message de l'utilisateur
    const userMsg = await addMessage(id, partySide, "user", message);

    // 2. Récupérer l'historique complet pour cette partie
    const history = await getMessagesForParty(id, partySide);

    // 3. Obtenir la réponse de l'IA défenseure
    const coachResponse = await askCoach(
      dispute.topic,
      partySide,
      history.filter((m) => m.id !== userMsg.id),
      message
    );

    // 4. Enregistrer la réponse du coach
    const coachMsg = await addMessage(
      id,
      partySide,
      "coach",
      coachResponse.message
    );

    return NextResponse.json({
      userMessage: userMsg,
      coachMessage: coachMsg,
      extractedPlea: coachResponse.extractedPlea || null,
      history: [...history, coachMsg],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
