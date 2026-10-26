import { NextResponse } from "next/server";
import { authenticateParty, toPartyView } from "@/lib/storage";
import { activeProvider } from "@/lib/llm";
import { errorResponse, PARTY_TOKEN_HEADER } from "@/lib/api";

// Vue privée d'une partie : son dossier et ses échanges avec son avocate
export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const { dispute, side } = await authenticateParty(id, req.headers.get(PARTY_TOKEN_HEADER));
    return NextResponse.json({ ...toPartyView(dispute, side), provider: activeProvider() });
  } catch (err: unknown) {
    return errorResponse(err);
  }
}
