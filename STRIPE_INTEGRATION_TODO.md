# Intégration Stripe — état et reste à faire

Intégration : **Hosted Stripe Checkout** (redirection vers une page de paiement hébergée par Stripe).
Scénario détecté : **A** — un appel `stripe.checkout.sessions.create()` existait déjà
(`src/lib/billing.ts`, fonction `createCheckoutUrl`). Seuls ses paramètres ont été mis à jour.

## Values to Replace

Aucune valeur fictive ne subsiste dans l'appel : `mode`, `success_url`, `cancel_url` et
`line_items` portent les valeurs réelles du projet.

**Fichiers concernés :**
- [src/lib/billing.ts](src/lib/billing.ts)

| Champ | Valeur actuelle | À faire |
|---|---|---|
| mode | `subscription` si l'offre est mensuelle, sinon `payment` | Rien — dérivé de `PLANS[planId].kind` |
| success_url | `${origin}/pricing?paid=1&session_id={CHECKOUT_SESSION_ID}` | Rien |
| cancel_url | `${origin}/pricing?canceled=1` | Rien |
| line_items[].price | `STRIPE_PRICE_*` (catalogue test) sinon `price_data` | Rien en test ; **en live, remplace les 4 `STRIPE_PRICE_*` par les IDs live** |

⚠️ **Seul manque bloquant : `STRIPE_SECRET_KEY` est vide dans `.env.local`.**
Sans elle : `/api/stripe/webhook` répond `500 {"error":"Stripe non configuré"}` et toute création
de session de paiement échoue. Clé test : Dashboard → Développeurs → Clés API (`sk_test_…`).
En production : clé **restreinte** `rk_live_…`, jamais `sk_live_`.

## Configured Parameters

Paramètres fixés par Checkout Studio (Dashboard), présents dans l'appel :

**Fichier :** [src/lib/billing.ts](src/lib/billing.ts) → `createCheckoutUrl()`

| Paramètre | Valeur |
|---|---|
| ui_mode | `hosted_page` (SDK stripe 23.0.1 ≥ 21.0.0) |
| origin_context | `web` |
| integration_identifier | `hosted_web_0001` |
| billing_address_collection | `auto` |
| phone_number_collection | `{ enabled: false }` |
| automatic_tax | `{ enabled: false }` |
| submit_type | `auto` |
| allow_promotion_codes | `true` |
| payment_method_collection | `always` — **uniquement en mode `subscription`** |

Tous ces noms ont été vérifiés contre la spec OpenAPI live (`PostCheckoutSessions`,
`2026-09-30.preview`) : ils existent, aucune faute de frappe, aucun paramètre inventé.

## Écarts assumés par rapport au prompt d'intégration

1. **Paramètres applicatifs conservés** : `customer`, `client_reference_id`, `metadata`,
   `subscription_data` ne viennent pas de Checkout Studio, mais sans eux le webhook ne sait pas
   quel compte créditer. Ils restent.
2. **`automatic_tax: { enabled: false }`** = pas de calcul de TVA par Stripe. Les 4 produits ont
   bien `tax_code = txcd_10103000`, mais il ne sert à rien tant que `automatic_tax` est désactivé.
   Pour un SaaS B2C français, la TVA à 20 % est due dès que l'activité est déclarée :
   **réactiver `automatic_tax` au passage en live**, et renseigner les origines fiscales dans
   Dashboard → Tax.
3. **Version d'API** : le client est construit sans `apiVersion` explicite. L'endpoint webhook,
   lui, est épinglé sur `2026-09-30.endive` côté Dashboard — garder les deux alignés lors des montées
   de version.

## Setup et prochaines étapes

**Variables d'environnement** (`.env.local`, `chmod 600`) :

```
STRIPE_SECRET_KEY=sk_test_…        # ← VIDE aujourd'hui
STRIPE_WEBHOOK_SECRET=whsec_…      # déjà en place
STRIPE_PRICE_SINGLE / PACK5 / PACK15 / MONTHLY   # déjà en place (IDs test)
```

**Déjà en place côté Stripe (compte `acct_1UUjQoIQY3gXwzdz`, mode test)** :
- 4 produits + prices, `tax_code` renseigné, `metadata.plan_id` présent
- webhook `we_1UVByIIQY3gXwzdzePpekatp` → `https://arbitra.24dw24.duckdns.org/api/stripe/webhook`,
  11 événements, API `2026-09-30.endive`

**Flux** :
1. `/pricing` → `POST /api/billing/checkout` → `createCheckoutUrl()` crée un Customer Stripe
   (stocké dans `profiles.stripe_customer_id`) puis une Session Checkout.
2. Redirection vers la page Stripe hébergée.
3. Retour sur `/pricing?paid=1`. Le crédit réel vient du **webhook** :
   `checkout.session.completed` → `grantCredits()` (idempotent via `ref`), `invoice.paid` →
   abonnement (remonte l'objet Subscription), `charge.refunded` / `dispute.created` /
   `early_fraud_warning` → tracés seulement.

**Test de bout en bout** (à faire dès que la clé est là) :
- carte `4242 4242 4242 4242`, date future quelconque, CVC `123`
- 3DS : `4000 0025 0000 3155`
- refus : `4000 0000 0000 9995`
- vérifier ensuite `profiles.credits` et la table des crédits accordés

**Avant le live** :
- clé restreinte `rk_live_…` + publier les clés
- recréer produits/prices en live (les IDs diffèrent) et mettre à jour les `STRIPE_PRICE_*`
- recréer le webhook en live (nouveau `whsec_`, même URL) + mettre à jour `STRIPE_WEBHOOK_SECRET`
- réactiver `automatic_tax`
- tester un vrai paiement à 1,99 € puis rembourser

**Ressources** : https://support.stripe.com · https://docs.stripe.com/mcp
