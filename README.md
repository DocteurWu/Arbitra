# L'Arbitre

Arbitrage de disputes privées par IA : chaque partie prépare son dossier avec une avocate IA,
puis un juge IA tranche. Next.js 16 · Supabase (comptes + Postgres) · Stripe · Claude / DeepSeek / OpenAI.

## Démarrage local (sans compte, sans paiement)

```bash
npm install
cp .env.example .env.local   # ajoute au moins une clé IA, sinon le simulateur local est utilisé
npm run dev
```

Sans clés Supabase, l'app tourne en **mode ouvert** : pas de connexion, pas de crédits,
litiges stockés dans `.data/disputes.json`.

## Activer les comptes et le paiement

1. **Supabase** : crée un projet, colle `supabase/schema.sql` dans *SQL Editor* et lance-le,
   puis renseigne les 3 variables `*SUPABASE*` (Project Settings > API).
   Dans *Authentication > URL Configuration*, ajoute `http://localhost:3000/auth/callback`
   (et l'URL de production) aux *Redirect URLs*.
2. **Stripe** : renseigne `STRIPE_SECRET_KEY` (clé de test `sk_test_…`).
   En local, relaie les webhooks :
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   copie le `whsec_…` affiché dans `STRIPE_WEBHOOK_SECRET`.
   Active aussi le *portail client* (Paramètres > Billing > Portail client) pour la gestion des abonnements.
3. Redémarre `npm run dev`. Carte de test : `4242 4242 4242 4242`, date future, CVC au choix.

## Modèle économique

- Chaque compte reçoit **1 litige offert** (trigger SQL à l'inscription).
- Ouvrir un litige **débite 1 crédit** (atomique, recrédité si la création échoue).
- Offres dans `src/lib/plans.ts` (prix envoyés à Stripe tels quels : rien à créer dans le dashboard).
- L'adversaire participe **sans compte**, avec son lien privé.
- Budget par litige : 12 messages à l'avocate par partie (`src/lib/limits.ts`).
- Les crédits ne sont accordés que par le webhook Stripe (`src/app/api/stripe/webhook`),
  de façon idempotente (`grant_credits`, clé = id de session/facture Stripe).

## Tests

```bash
node test-e2e.mjs   # parcours complet contre http://localhost:3000
```
