import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import {
  Dispute,
  DisputeStatus,
  Party,
  PartySide,
  Plea,
  ChatMessage,
  Verdict,
} from "@/types/dispute";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "disputes.json");

// In-memory cache for fast access
let memoryCache: Record<string, Dispute> | null = null;
let isInitialized = false;

async function ensureStorageInitialized(): Promise<void> {
  if (isInitialized) return;

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      const content = await fs.readFile(DATA_FILE, "utf-8");
      memoryCache = JSON.parse(content);
    } catch {
      memoryCache = {};
      await fs.writeFile(DATA_FILE, JSON.stringify({}, null, 2), "utf-8");
    }
  } catch (err) {
    console.error("Failed to initialize storage:", err);
    if (!memoryCache) memoryCache = {};
  }
  isInitialized = true;
}

async function persistToDisk(): Promise<void> {
  if (!memoryCache) return;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tempFile = `${DATA_FILE}.tmp.${Date.now()}`;
    await fs.writeFile(tempFile, JSON.stringify(memoryCache, null, 2), "utf-8");
    await fs.rename(tempFile, DATA_FILE);
  } catch (err) {
    console.error("Storage persistence error:", err);
  }
}

function generateToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

export async function createDispute(
  topic: string,
  gage: string,
  nameA = "Partie A",
  nameB = "Partie B"
): Promise<{ dispute: Dispute; tokenA: string; tokenB: string }> {
  await ensureStorageInitialized();

  const id = crypto.randomUUID();
  const tokenA = generateToken();
  const tokenB = generateToken();

  const partyA: Party = {
    side: "A",
    name: nameA,
    token: tokenA,
    plea: null,
    rebuttal: null,
    readyForRebuttal: false,
  };

  const partyB: Party = {
    side: "B",
    name: nameB,
    token: tokenB,
    plea: null,
    rebuttal: null,
    readyForRebuttal: false,
  };

  const dispute: Dispute = {
    id,
    topic,
    gage,
    status: "created",
    createdAt: new Date().toISOString(),
    parties: {
      A: partyA,
      B: partyB,
    },
    messages: [],
    verdict: null,
  };

  memoryCache![id] = dispute;
  await persistToDisk();

  return { dispute, tokenA, tokenB };
}

export async function getDispute(id: string): Promise<Dispute | null> {
  await ensureStorageInitialized();
  return memoryCache![id] || null;
}

export async function getDisputeByPartyToken(
  token: string
): Promise<{ dispute: Dispute; party: Party } | null> {
  await ensureStorageInitialized();

  for (const dispute of Object.values(memoryCache!)) {
    if (dispute.parties.A.token === token) {
      return { dispute, party: dispute.parties.A };
    }
    if (dispute.parties.B.token === token) {
      return { dispute, party: dispute.parties.B };
    }
  }

  return null;
}

export async function addMessage(
  disputeId: string,
  partySide: PartySide,
  sender: "user" | "coach",
  content: string
): Promise<ChatMessage> {
  await ensureStorageInitialized();

  const dispute = memoryCache![disputeId];
  if (!dispute) throw new Error("Dispute not found");

  const message: ChatMessage = {
    id: crypto.randomUUID(),
    partySide,
    sender,
    content,
    createdAt: new Date().toISOString(),
  };

  dispute.messages.push(message);

  if (dispute.status === "created") {
    dispute.status = "coaching";
  }

  await persistToDisk();
  return message;
}

export async function getMessagesForParty(
  disputeId: string,
  partySide: PartySide
): Promise<ChatMessage[]> {
  await ensureStorageInitialized();
  const dispute = memoryCache![disputeId];
  if (!dispute) return [];
  return dispute.messages.filter((m) => m.partySide === partySide);
}

export async function savePlea(
  disputeId: string,
  partySide: PartySide,
  plea: Plea
): Promise<Dispute> {
  await ensureStorageInitialized();

  const dispute = memoryCache![disputeId];
  if (!dispute) throw new Error("Dispute not found");

  dispute.parties[partySide].plea = {
    ...plea,
    submittedAt: new Date().toISOString(),
  };
  dispute.parties[partySide].readyForRebuttal = true;

  // Si les deux parties ont soumis leur plaidoirie, on bascule en 'rebuttal'
  if (
    dispute.parties.A.plea !== null &&
    dispute.parties.B.plea !== null
  ) {
    dispute.status = "rebuttal";
  }

  await persistToDisk();
  return dispute;
}

export async function saveRebuttal(
  disputeId: string,
  partySide: PartySide,
  rebuttalText: string
): Promise<Dispute> {
  await ensureStorageInitialized();

  const dispute = memoryCache![disputeId];
  if (!dispute) throw new Error("Dispute not found");

  dispute.parties[partySide].rebuttal = rebuttalText.trim();

  // Si les deux ont répondu, on passe à 'judging'
  if (
    dispute.parties.A.rebuttal !== null &&
    dispute.parties.B.rebuttal !== null
  ) {
    dispute.status = "judging";
  }

  await persistToDisk();
  return dispute;
}

export async function saveVerdict(
  disputeId: string,
  verdict: Verdict
): Promise<Dispute> {
  await ensureStorageInitialized();

  const dispute = memoryCache![disputeId];
  if (!dispute) throw new Error("Dispute not found");

  dispute.verdict = verdict;
  dispute.status = "resolved";

  await persistToDisk();
  return dispute;
}

export async function updateDisputeStatus(
  disputeId: string,
  status: DisputeStatus
): Promise<Dispute> {
  await ensureStorageInitialized();

  const dispute = memoryCache![disputeId];
  if (!dispute) throw new Error("Dispute not found");

  dispute.status = status;
  await persistToDisk();
  return dispute;
}
