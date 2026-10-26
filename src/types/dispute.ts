export type DisputeStatus =
  | "created"
  | "coaching"
  | "rebuttal"
  | "judging"
  | "resolved";

export type PartySide = "A" | "B";

export interface Plea {
  summary: string;
  facts: string[];
  demand: string;
  concession?: string;
  submittedAt?: string;
}

export interface Party {
  side: PartySide;
  name: string;
  token: string;
  plea: Plea | null;
  rebuttal: string | null;
  readyForRebuttal: boolean;
}

export interface ChatMessage {
  id: string;
  partySide: PartySide;
  sender: "user" | "coach";
  content: string;
  createdAt: string;
}

export interface PointRuling {
  issue: string;
  rulingFor: "A" | "B" | "EQUAL";
  reasoning: string;
}

export interface Verdict {
  winner: "A" | "B" | "50-50";
  headline: string;
  pointsAnalysis: PointRuling[];
  loserPenalty: string;
  closureAdvice: string;
  // Solidité globale de chaque dossier, de 0 à 100
  scoreA?: number;
  scoreB?: number;
  // true si le verdict vient du simulateur local (aucune clé API)
  simulated?: boolean;
  generatedAt: string;
}

export interface Dispute {
  // Compte qui a payé le litige (null en mode ouvert, sans comptes)
  ownerId?: string | null;
  id: string;
  topic: string;
  gage: string;
  status: DisputeStatus;
  createdAt: string;
  parties: {
    A: Party;
    B: Party;
  };
  messages: ChatMessage[];
  verdict: Verdict | null;
  // Dernière erreur de l'arbitrage, pour permettre de relancer
  verdictError?: string | null;
}

// --- Vues exposées par l'API (jamais de token ni de messages privés) ---

export interface PublicParty {
  side: PartySide;
  name: string;
  hasPlea: boolean;
  hasRebuttal: boolean;
  // Visible uniquement une fois les deux plaidoiries déposées
  plea: Plea | null;
  // Visible uniquement une fois le verdict rendu
  rebuttal: string | null;
}

export interface PublicDispute {
  id: string;
  topic: string;
  gage: string;
  status: DisputeStatus;
  createdAt: string;
  parties: {
    A: PublicParty;
    B: PublicParty;
  };
  verdict: Verdict | null;
  verdictError: string | null;
}

export interface PartyView {
  dispute: PublicDispute;
  me: {
    side: PartySide;
    name: string;
    plea: Plea | null;
    rebuttal: string | null;
    messagesLeft: number;
  };
  opponent: PublicParty;
  messages: ChatMessage[];
}
