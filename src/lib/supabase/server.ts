import { createServerClient } from "@supabase/ssr";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/** Les comptes et le paiement ne sont actifs que si Supabase est configuré. Sinon : mode ouvert (dev local). */
export function isAuthEnabled(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Client lié à la session (cookies) de l'utilisateur courant. */
export async function createSessionClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Appelé depuis un Server Component : le rafraîchissement est fait par proxy.ts
        }
      },
    },
  });
}

let admin: SupabaseClient | null = null;

/** Client « service_role » : contourne la RLS. Strictement réservé au serveur. */
export function adminClient(): SupabaseClient {
  if (!admin) {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

export interface CurrentUser {
  id: string;
  email: string;
}

/** Utilisateur connecté (vérifié auprès de Supabase), ou null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!isAuthEnabled()) return null;
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { id: data.user.id, email: data.user.email ?? "" };
}
