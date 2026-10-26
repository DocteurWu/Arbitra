import { NextResponse } from "next/server";
import { getDispute, toPublicDispute } from "@/lib/storage";
import { activeProvider } from "@/lib/llm";
import { errorResponse } from "@/lib/api";

// Vue publique : ni tokens, ni échanges privés avec les avocates
export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const dispute = await getDispute(id);

    if (!dispute) {
      return NextResponse.json({ error: "Litige introuvable" }, { status: 404 });
    }

    return NextResponse.json({ dispute: toPublicDispute(dispute), provider: activeProvider() });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
