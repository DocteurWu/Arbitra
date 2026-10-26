// test-e2e.mjs
async function run() {
  const BASE_URL = "http://localhost:3000";
  console.log("=== 1. CRÉATION DU LITIGE ===");
  const createRes = await fetch(`${BASE_URL}/api/disputes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic: "Qui devait sortir les poubelles mardi soir ?",
      gage: "🍽️ Fait la vaisselle pendant 3 jours",
      nameA: "Louai",
      nameB: "Alex",
    }),
  });
  const createData = await createRes.json();
  console.log("Status:", createRes.status);
  console.log("Dispute ID:", createData.dispute.id);
  console.log("Token A:", createData.tokenA);
  console.log("Token B:", createData.tokenB);

  const disputeId = createData.dispute.id;
  const tokenA = createData.tokenA;
  const tokenB = createData.tokenB;

  console.log("\n=== 2. COACHING PARTIE A ===");
  const coachARes = await fetch(`${BASE_URL}/api/disputes/${disputeId}/coach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: tokenA,
      message: "Mardi c'était le tour d'Alex selon notre tableau de bord. La poubelle débordait.",
    }),
  });
  const coachAData = await coachARes.json();
  console.log("Coach A réponse:", coachAData.view.messages.at(-1).content.slice(0, 80) + "...");

  console.log("\n=== 3. VALIDATION PLAIDOIRIE PARTIE A ===");
  const pleaARes = await fetch(`${BASE_URL}/api/disputes/${disputeId}/plea`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: tokenA,
      plea: {
        summary: "Alex devait sortir les poubelles mardi selon le calendrier partagé.",
        facts: ["Tour planifié mardi", "Poubelle restée pleine"],
        demand: "Alex doit faire la vaisselle pendant 3 jours comme convenu.",
        concession: "Prêt à échanger les jours la semaine prochaine si prévenu à l'avance.",
      },
    }),
  });
  const pleaAData = await pleaARes.json();
  console.log("Plea A statut:", pleaAData.status);

  console.log("\n=== 4. COACHING ET PLAIDOIRIE PARTIE B ===");
  const pleaBRes = await fetch(`${BASE_URL}/api/disputes/${disputeId}/plea`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: tokenB,
      plea: {
        summary: "J'avais prévenu par message que je rentrais à 23h et j'ai demandé de l'aide.",
        facts: ["Message envoyé à 19h", "Rentré à 23h30 après une urgence"],
        demand: "Partage de la tâche sans pénalité.",
        concession: "Prendre en charge les poubelles tout le week-end.",
      },
    }),
  });
  const pleaBData = await pleaBRes.json();
  console.log("Dispute statut après Plea B (attendu: rebuttal) :", pleaBData.status);

  console.log("\n=== 5. RÉPLIQUE UNIQUE PARTIE A ===");
  const rebARes = await fetch(`${BASE_URL}/api/disputes/${disputeId}/rebuttal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: tokenA,
      rebuttal: "Le message à 19h n'a jamais mentionné les poubelles, juste un retard.",
    }),
  });
  const rebAData = await rebARes.json();
  console.log("Réplique A soumise, verdict prêt ?", rebAData.verdictReady);

  console.log("\n=== 6. RÉPLIQUE UNIQUE PARTIE B (DÉCLENCHE LE JUGE) ===");
  const rebBRes = await fetch(`${BASE_URL}/api/disputes/${disputeId}/rebuttal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: tokenB,
      rebuttal: "J'avais pourtant précisé que je ne pourrais rien faire en rentrant.",
    }),
  });
  const rebBData = await rebBRes.json();
  console.log("Verdict prêt ?", rebBData.verdictReady);
  console.log("Statut dispute:", rebBData.view.dispute.status);
  if (rebBData.view.dispute.verdict) {
    console.log("\n=== VERDICT OFFICIEL DU JUGE ===");
    console.log("Gagnant :", rebBData.view.dispute.verdict.winner);
    console.log("Titre :", rebBData.view.dispute.verdict.headline);
    console.log("Gage :", rebBData.view.dispute.verdict.loserPenalty);
    console.log("Conseil :", rebBData.view.dispute.verdict.closureAdvice);
    console.log("\nTest E2E réussi à 100% !");
  } else {
    console.error("ERREUR: Le verdict n'a pas été généré.");
  }
}

run().catch(console.error);
