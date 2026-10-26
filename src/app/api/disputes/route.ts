import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { createDispute, toPublicDispute } from "@/lib/storage";
import { errorResponse } from "@/lib/api";
import { getCurrentUser, isAuthEnabled } from "@/lib/supabase/server";
import { consumeCredit, grantCredits } from "@/lib/billing";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { GAGE_MAX_LENGTH, NAME_MAX_LENGTH, TOPIC_MAX_LENGTH } from "@/lib/limits";

const CreateDisputeSchema = z.object({
  topic: z
    .string()
    .trim()
    .min(5, "L'objet du litige doit comporter au moins 5 caractères")
    .max(TOPIC_MAX_LENGTH, `L'objet du litige doit tenir en ${TOPIC_MAX_LENGTH} caractères`),
  gage: z
    .string()
    .trim()
    .min(3, "Veuillez spécifier un gage")
    .max(GAGE_MAX_LENGTH, `Gage trop long (${GAGE_MAX_LENGTH} caractères max)`),
  nameA: z.string().trim().max(NAME_MAX_LENGTH).optional().transform((v) => v || "Partie A"),
  nameB: z.string().trim().max(NAME_MAX_LENGTH).optional().transform((v) => v || "Partie B"),
});

export async function POST(req: Request) {
  let refund: (() => Promise<void>) | null = null;

  try {
    const validated = CreateDisputeSchema.parse(await req.json());
    if (validated.nameA.toLowerCase() === validated.nameB.toLowerCase()) {
      return NextResponse.json({ error: "Les deux parties doivent avoir des prénoms différents" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    let ownerId: string | null = null;

    if (isAuthEnabled()) {
      // Un litige = un crédit, débité à la création (recrédité si la création échoue)
      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ error: "Connecte-toi pour ouvrir un litige.", code: "auth_required" }, { status: 401 });
      }
      const limited = rateLimit(`create:${user.id}`, 10, 60 * 60_000);
      if (limited) return limited;

      if (!(await consumeCredit(user.id, `dispute:${id}`))) {
        return NextResponse.json(
          { error: "Tu n'as plus de crédit. Choisis une offre pour ouvrir un nouveau litige.", code: "no_credits" },
          { status: 402 }
        );
      }
      ownerId = user.id;
      const userId = user.id;
      refund = async () => {
        await grantCredits(userId, 1, "refund", `refund:${id}`);
      };
    } else {
      const limited = rateLimit(`create:${clientIp(req)}`, 30, 60 * 60_000);
      if (limited) return limited;
    }

    const { dispute, tokenA, tokenB } = await createDispute(
      validated.topic,
      validated.gage,
      validated.nameA,
      validated.nameB,
      ownerId,
      id
    );

    return NextResponse.json({
      dispute: toPublicDispute(dispute),
      tokenA,
      tokenB,
      links: {
        hub: `/d/${dispute.id}`,
        partyA: `/d/${dispute.id}/party/${tokenA}`,
        partyB: `/d/${dispute.id}/party/${tokenB}`,
        verdict: `/d/${dispute.id}/verdict`,
      },
    });
  } catch (err: unknown) {
    if (refund) await refund().catch((e) => console.error("Remboursement impossible :", e));
    return errorResponse(err);
  }
}
