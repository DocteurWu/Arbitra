import { NextResponse } from "next/server";
import { z } from "zod";
import { createDispute, toPublicDispute } from "@/lib/storage";
import { errorResponse } from "@/lib/api";

const CreateDisputeSchema = z.object({
  topic: z
    .string()
    .trim()
    .min(5, "L'objet du litige doit comporter au moins 5 caractères")
    .max(280, "L'objet du litige doit tenir en 280 caractères"),
  gage: z.string().trim().min(3, "Veuillez spécifier un gage").max(160, "Gage trop long (160 caractères max)"),
  nameA: z.string().trim().max(40).optional().transform((v) => v || "Partie A"),
  nameB: z.string().trim().max(40).optional().transform((v) => v || "Partie B"),
});

export async function POST(req: Request) {
  try {
    const validated = CreateDisputeSchema.parse(await req.json());
    if (validated.nameA.toLowerCase() === validated.nameB.toLowerCase()) {
      return NextResponse.json({ error: "Les deux parties doivent avoir des prénoms différents" }, { status: 400 });
    }

    const { dispute, tokenA, tokenB } = await createDispute(
      validated.topic,
      validated.gage,
      validated.nameA,
      validated.nameB
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
    return errorResponse(err);
  }
}
