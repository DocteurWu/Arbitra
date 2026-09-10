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
  generatedAt: string;
}

export interface Dispute {
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
}
