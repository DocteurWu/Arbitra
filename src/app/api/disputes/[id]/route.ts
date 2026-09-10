import { NextResponse } from "next/server";
import { getDispute } from "@/lib/storage";

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const dispute = await getDispute(id);

    if (!dispute) {
      return NextResponse.json(
        { error: "Dispute non trouvée" },
        { status: 404 }
      );
    }

    return NextResponse.json({ dispute });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
