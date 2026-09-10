import { NextResponse } from "next/server";
import { z } from "zod";
import { createDispute } from "@/lib/storage";

const CreateDisputeSchema = z.object({
  topic: z.string().min(5, "L'objet du litige doit comporter au moins 5 caractères"),
  gage: z.string().min(3, "Veuillez spécifier un gage"),
  nameA: z.string().optional().default("Partie A"),
  nameB: z.string().optional().default("Partie B"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = CreateDisputeSchema.parse(body);

    const { dispute, tokenA, tokenB } = await createDispute(
      validated.topic,
      validated.gage,
      validated.nameA,
      validated.nameB
    );

    return NextResponse.json({
      dispute,
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
    const message = err instanceof Error ? err.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
