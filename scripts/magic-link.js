#!/usr/bin/env node
// Génère un lien de connexion direct utilisable sans email ni SMTP.
// Usage : node scripts/magic-link.js <email> [chemin-de-retour]
// Le lien pointe sur /auth/confirm de l'app (route maison), donc il ne dépend ni du
// Site URL de Supabase ni du quota d'emails : il ne consomme rien.
const fs = require("fs");

const env = {};
for (const line of fs.readFileSync("/home/dietpi/Arbitra/.env.local", "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i > 0 && !line.startsWith("#")) env[line.slice(0, i)] = line.slice(i + 1);
}
const BASE = (process.env.APP_URL || env.APP_URL || "https://arbitra.24dw24.duckdns.org").replace(/\/+$/, "");
const email = process.argv[2];
const next = process.argv[3] || "/";
if (!email) {
  console.error("usage: node scripts/magic-link.js <email> [next]");
  process.exit(1);
}

(async () => {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "magiclink", email }),
  });
  const data = await res.json();
  if (!data.hashed_token) {
    console.error("échec :", JSON.stringify(data).slice(0, 300));
    process.exit(1);
  }
  const url = `${BASE}/auth/confirm?token_hash=${data.hashed_token}&type=magiclink&next=${encodeURIComponent(next)}`;
  console.log(url);
  console.log(`\n(usage unique — expire vite. email=${email} next=${next})`);
})();
