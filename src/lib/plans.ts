// Catalogue des offres. Source de vérité unique : les prix sont envoyés à Stripe tels quels
// (price_data), il n'y a donc rien à créer dans le tableau de bord Stripe.
// ⚠ Prix provisoires : à ajuster avant le lancement.

export type PlanId = "single" | "pack5" | "pack15" | "monthly";

export interface Plan {
  id: PlanId;
  kind: "pack" | "subscription";
  name: string;
  description: string;
  credits: number; // crédits accordés (par mois pour l'abonnement)
  amountCents: number;
  highlight?: boolean;
}

export const CURRENCY = "eur";

export const PLANS: Record<PlanId, Plan> = {
  single: {
    id: "single",
    kind: "pack",
    name: "1 litige",
    description: "Un arbitrage complet, sans engagement",
    credits: 1,
    amountCents: 199,
  },
  pack5: {
    id: "pack5",
    kind: "pack",
    name: "Pack 5 litiges",
    description: "Pour les colocs et les couples qui s'aiment bien",
    credits: 5,
    amountCents: 799,
    highlight: true,
  },
  pack15: {
    id: "pack15",
    kind: "pack",
    name: "Pack 15 litiges",
    description: "Le meilleur prix par litige",
    credits: 15,
    amountCents: 1799,
  },
  monthly: {
    id: "monthly",
    kind: "subscription",
    name: "Abonnement mensuel",
    description: "10 litiges chaque mois, résiliable à tout moment",
    credits: 10,
    amountCents: 699,
  },
};

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && value in PLANS;
}

export function formatPrice(amountCents: number): string {
  return (amountCents / 100).toLocaleString("fr-FR", { style: "currency", currency: CURRENCY.toUpperCase() });
}
