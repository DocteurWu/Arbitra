import { getDispute, saveVerdict, saveVerdictError } from "@/lib/storage";
import { askJudge } from "@/lib/llm";
import { Dispute } from "@/types/dispute";

// Évite de lancer deux délibérations en parallèle pour le même litige
const inFlight = new Map<string, Promise<Dispute>>();

/**
 * Lance l'arbitrage si le dossier est complet (deux plaidoiries + deux répliques).
 * En cas d'échec, l'erreur est stockée sur le litige pour pouvoir relancer.
 */
export function runJudgement(disputeId: string): Promise<Dispute> {
  const pending = inFlight.get(disputeId);
  if (pending) return pending;

  const run = (async () => {
    const dispute = await getDispute(disputeId);
    if (!dispute) throw new Error("Litige introuvable");
    if (dispute.verdict) return dispute;

    const { A, B } = dispute.parties;
    if (!A.plea || !B.plea || A.rebuttal === null || B.rebuttal === null) {
      return dispute;
    }

    try {
      const verdict = await askJudge(
        dispute.topic,
        dispute.gage,
        { name: A.name, plea: A.plea, rebuttal: A.rebuttal },
        { name: B.name, plea: B.plea, rebuttal: B.rebuttal }
      );
      return await saveVerdict(disputeId, verdict);
    } catch (err) {
      console.error("Erreur lors de l'arbitrage:", err);
      const message = err instanceof Error ? err.message : "Erreur inconnue";
      return saveVerdictError(disputeId, message);
    }
  })().finally(() => inFlight.delete(disputeId));

  inFlight.set(disputeId, run);
  return run;
}
