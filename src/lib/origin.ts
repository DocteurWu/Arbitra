/**
 * Origine publique de l'application.
 *
 * Derrière NGINX, `new URL(request.url).origin` renvoie l'adresse interne
 * (http://localhost:3000) et pas le domaine public : les redirections de retour
 * (Stripe success_url / cancel_url, portail de facturation, liens de connexion)
 * pointaient donc vers localhost en production.
 *
 * Ordre de priorité : APP_URL (variables d'env) > en-têtes de proxy > URL de la requête.
 */
export function publicOrigin(request: Request): string {
  const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const headers = request.headers;
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (host) {
    const proto = headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return new URL(request.url).origin;
}
