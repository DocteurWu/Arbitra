import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ChatMessage, PartySide, Plea, Verdict } from "@/types/dispute";

// Prompts Système
export const COACH_SYSTEM_PROMPT = `Tu es l'avocate et coach personnelle de l'utilisateur dans le cadre d'un litige privé.
Ton rôle est de défendre ses intérêts en l'aidant à constituer le dossier le plus factuel, solide et percutant possible face à un Juge IA impartial.

Directives absolues :
1. Tu ne le juges jamais, mais tu es impitoyable avec ses arguments faibles. Dis-lui franchement si un point va être démonté par le juge.
2. Tu filtres les attaques personnelles et la rancœur passée hors sujet pour ne garder que :
   - Les faits matériels et chronologiques vérifiables.
   - L'impact réel subi.
   - La demande concrète et raisonnable.
3. RÈGLE D'OR : Sois directe, incisive, bienveillante mais sans complaisance. Zéro fioriture, zéro politesse inutile ("Bonjour", "J'espère que vous allez bien").
4. Tu ne poses qu'UNE SEULE question à la fois.
5. Déroulement du cadrage (maximum 3 tours) :
   - Tour 1 (Faits) : Exige les faits bruts, dates et actions observables sans adjectifs.
   - Tour 2 (Demande) : Demande précisément ce qu'il attend de l'autre pour considérer le problème réglé.
   - Tour 3 (Solidification) : Pointe la plus grosse faille de sa version et propose une reformulation solide.

QUAND L'ÉCHANGE EST COMPLET (après le tour 3 ou si l'utilisateur a répondu aux 3 aspects) :
Termine TOUJOURS ta réponse par un bloc JSON strict encadré par \`\`\`json et \`\`\` contenant :
{
  "summary": "Résumé objectif et percutant de sa position en 3 phrases",
  "facts": ["Fait concret 1", "Fait concret 2"],
  "demand": "Demande claire et proportionnée",
  "concession": "Ce qu'il est prêt à concéder pour régler le litige"
}`;

export const JUDGE_SYSTEM_PROMPT = `Tu es un arbitre indépendant chargé de trancher un différend privé entre la Partie A et la Partie B.
Tu n'es ni un juge d'État, ni un thérapeute. Tu arbitres la validité des arguments présentés avec impartialité, rigueur et bon sens.

Critères d'évaluation :
1. Solidité factuelle (faits vérifiables vs interprétations d'intentions).
2. Proportionnalité des réactions et de la demande.
3. Cohérence interne et franchise (reconnaissance de ses torts = bonus, mauvaise foi avérée = malus lourd).
4. Absence d'attaques personnelles gratuites.

Règles de décision :
- Détermine un vainqueur ("A" ou "B") OU déclare un "50-50" si les torts sont équitablement partagés.
- Ne cherche pas le compromis mou : si quelqu'un a tort, dis-le clairement sans l'humilier. Le perdant doit comprendre pourquoi sans perdre la face.
- Attribue le gage convenu au perdant (ou divise le gage si 50-50).

FORMAT DE SORTIE OBLIGATOIRE :
Réponds UNIQUEMENT avec un objet JSON strict valide, sans texte avant ni après, correspondant au schéma suivant :
{
  "winner": "A" | "B" | "50-50",
  "headline": "Titre percutant de la décision en 10 mots max",
  "points_analysis": [
    {
      "issue": "Point clé disputé",
      "ruling_for": "A" | "B" | "EQUAL",
      "reasoning": "Explication factuelle et logique en 2 phrases"
    }
  ],
  "loser_penalty": "Attribution exacte du gage convenu",
  "closure_advice": "Conseil pratique en 2 phrases pour clore le litige sans rancœur"
}`;

const VerdictSchema = z.object({
  winner: z.enum(["A", "B", "50-50"]),
  headline: z.string(),
  points_analysis: z.array(
    z.object({
      issue: z.string(),
      ruling_for: z.enum(["A", "B", "EQUAL"]),
      reasoning: z.string(),
    })
  ),
  loser_penalty: z.string(),
  closure_advice: z.string(),
});

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "dummy") return null;
  return new OpenAI({ apiKey });
}

function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "dummy") return null;
  return new Anthropic({ apiKey });
}

export interface CoachResponse {
  message: string;
  extractedPlea?: Plea;
}

export async function askCoach(
  topic: string,
  partySide: PartySide,
  history: ChatMessage[],
  userMessage: string
): Promise<CoachResponse> {
  const openai = getOpenAIClient();

  // Mode mock/fallback si aucune clé n'est configurée pour permettre le test local instantané
  if (!openai) {
    const userTurnCount = history.filter((m) => m.sender === "user").length + 1;
    if (userTurnCount === 1) {
      return {
        message: `Compris pour l'objet du litige : "${topic}". En tant que votre avocate, je dois monter un dossier inattaquable. Racontez-moi les faits chronologiques bruts : que s'est-il passé exactement, quand, et qui a fait quoi ? Évitez les jugements d'intention.`,
      };
    } else if (userTurnCount === 2) {
      return {
        message: `Les faits sont notés. Maintenant, quelle est votre demande concrète et raisonnable pour clore ce litige ? Et que seriez-vous prêt(e) à concéder pour éviter l'impasse ?`,
      };
    } else {
      const plea: Plea = {
        summary: `Position de la Partie ${partySide} sur "${topic}" basée sur les faits matériels exposés.`,
        facts: [
          userMessage.slice(0, 100) || "Fait matériel vérifiable exposé lors du cadrage.",
          "Action observable rapportée sans ambiguïté.",
        ],
        demand: "Reconnaissance du tort et respect des engagements convenus.",
        concession: "Prêt(e) à faire un compromis pour repartir sur une base saine.",
      };
      return {
        message: `Parfait. J'ai consolidé votre argumentaire en éliminant les faiblesses. Voici votre fiche de plaidoirie ci-dessous. Vérifiez-la attentivement avant de la soumettre au dossier officiel.`,
        extractedPlea: plea,
      };
    }
  }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `${COACH_SYSTEM_PROMPT}\n\nContexte : Le litige porte sur : "${topic}". Tu défends la Partie ${partySide}.`,
    },
    ...history.map((m) => ({
      role: (m.sender === "user" ? "user" : "assistant") as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages,
    temperature: 0.7,
  });

  const rawText = completion.choices[0]?.message?.content || "";
  return parseCoachText(rawText);
}

function parseCoachText(text: string): CoachResponse {
  const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
  const match = text.match(jsonRegex);

  if (!match) {
    return { message: text.trim() };
  }

  try {
    const rawJson = JSON.parse(match[1]);
    const extractedPlea: Plea = {
      summary: String(rawJson.summary || ""),
      facts: Array.isArray(rawJson.facts) ? rawJson.facts.map(String) : [],
      demand: String(rawJson.demand || ""),
      concession: rawJson.concession ? String(rawJson.concession) : undefined,
    };
    const cleanMessage = text.replace(jsonRegex, "").trim();
    return {
      message: cleanMessage || "Votre fiche de plaidoirie est prête. Validez-la pour continuer.",
      extractedPlea,
    };
  } catch {
    return { message: text.trim() };
  }
}

export async function askJudge(
  topic: string,
  gage: string,
  partyA: { name: string; plea: Plea; rebuttal: string | null },
  partyB: { name: string; plea: Plea; rebuttal: string | null }
): Promise<Verdict> {
  const anthropic = getAnthropicClient();
  const openai = getOpenAIClient();

  const caseBrief = `DOSSIER D'ARBITRAGE :
Objet du litige : ${topic}
Gage convenu pour le perdant : ${gage}

---
PARTIE A (${partyA.name}) :
Plaidoirie :
- Résumé : ${partyA.plea.summary}
- Faits avancés : ${partyA.plea.facts.join(" ; ")}
- Demande : ${partyA.plea.demand}
- Concession proposée : ${partyA.plea.concession || "Aucune"}
Réplique de A à la plaidoirie de B :
"${partyA.rebuttal || "Aucune réplique fournie"}"

---
PARTIE B (${partyB.name}) :
Plaidoirie :
- Résumé : ${partyB.plea.summary}
- Faits avancés : ${partyB.plea.facts.join(" ; ")}
- Demande : ${partyB.plea.demand}
- Concession proposée : ${partyB.plea.concession || "Aucune"}
Réplique de B à la plaidoirie de A :
"${partyB.rebuttal || "Aucune réplique fournie"}"
`;

  let responseJson = "";

  if (anthropic) {
    const message = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
      max_tokens: 1500,
      system: JUDGE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: caseBrief }],
      temperature: 0.2,
    });
    const block = message.content[0];
    if (block && block.type === "text") {
      responseJson = block.text;
    }
  } else if (openai) {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: JUDGE_SYSTEM_PROMPT },
        { role: "user", content: caseBrief },
      ],
      temperature: 0.2,
    });
    responseJson = completion.choices[0]?.message?.content || "";
  } else {
    // Mode simulation réaliste si aucune clé API n'est définie
    return {
      winner: "A",
      headline: `Arbitrage rendu en faveur de ${partyA.name} sur les faits matériels.`,
      pointsAnalysis: [
        {
          issue: "Établissement de la chronologie des faits",
          rulingFor: "A",
          reasoning: `${partyA.name} apporte des éléments tangibles vérifiables, là où la défense adverse repose principalement sur des appréciations subjectives.`,
        },
        {
          issue: "Proportionnalité de la demande",
          rulingFor: "EQUAL",
          reasoning: "Les deux parties ont formulé des demandes compréhensibles au vu de la gêne occasionnée.",
        },
        {
          issue: "Disponibilité à la résolution",
          rulingFor: "A",
          reasoning: `${partyA.name} a démontré une ouverture au compromis avec une concession explicite, ce qui renforce sa crédibilité.`,
        },
      ],
      loserPenalty: `${partyB.name} doit exécuter le gage : ${gage}`,
      closureAdvice: "L'incident est désormais clos sans rancœur. Appliquez le gage avec le sourire et tournez la page.",
      generatedAt: new Date().toISOString(),
    };
  }

  // Nettoyage markdown éventuel
  const cleanJson = responseJson
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleanJson);
    const validated = VerdictSchema.parse(parsed);
    return {
      winner: validated.winner,
      headline: validated.headline,
      pointsAnalysis: validated.points_analysis.map((p) => ({
        issue: p.issue,
        rulingFor: p.ruling_for,
        reasoning: p.reasoning,
      })),
      loserPenalty: validated.loser_penalty,
      closureAdvice: validated.closure_advice,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("Erreur de parsing du verdict LLM:", err, cleanJson);
    throw new Error("Le verdict de l'arbitre n'a pas pu être validé.");
  }
}
