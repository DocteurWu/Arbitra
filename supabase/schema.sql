-- L'Arbitre — schéma Supabase
-- À coller dans Supabase > SQL Editor > New query > Run (idempotent : relançable sans risque).

-- 1. Profils : un par compte, avec le solde de crédits ------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  credits integer not null default 0 check (credits >= 0),
  stripe_customer_id text unique,
  created_at timestamptz not null default now()
);

-- 2. Journal des crédits : audit + idempotence des webhooks Stripe -------------------------
create table if not exists public.credit_ledger (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  delta integer not null,
  reason text not null,            -- 'signup_free' | 'purchase_pack' | 'subscription' | 'dispute_created' | 'refund'
  ref text unique,                 -- identifiant externe (session/facture Stripe, id du litige…) : empêche les doublons
  created_at timestamptz not null default now()
);
create index if not exists credit_ledger_user_idx on public.credit_ledger (user_id, created_at desc);

-- 3. Litiges : l'objet complet en JSON, avec un numéro de version (écritures concurrentes) ---
create table if not exists public.disputes (
  id uuid primary key,
  owner_id uuid references auth.users (id) on delete set null,
  data jsonb not null,
  version integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists disputes_owner_idx on public.disputes (owner_id, created_at desc);

-- 4. Sécurité : RLS activée. Seul le serveur (clé service_role) accède aux litiges et au journal.
alter table public.profiles enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.disputes enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);

-- 5. Création automatique du profil + 1 litige offert à l'inscription -----------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, credits) values (new.id, new.email, 1)
  on conflict (id) do nothing;
  insert into public.credit_ledger (user_id, delta, reason, ref)
  values (new.id, 1, 'signup_free', 'signup:' || new.id::text)
  on conflict (ref) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 6. Débit atomique d'un crédit (false si solde insuffisant) --------------------------------
create or replace function public.consume_credit(p_user uuid, p_ref text) returns boolean
language plpgsql security definer set search_path = public as $$
declare updated integer;
begin
  update public.profiles set credits = credits - 1 where id = p_user and credits > 0;
  get diagnostics updated = row_count;
  if updated = 0 then return false; end if;
  insert into public.credit_ledger (user_id, delta, reason, ref) values (p_user, -1, 'dispute_created', p_ref);
  return true;
end $$;

-- 7. Ajout idempotent de crédits : rejouer le même p_ref ne crédite qu'une fois -------------
create or replace function public.grant_credits(p_user uuid, p_amount integer, p_reason text, p_ref text) returns boolean
language plpgsql security definer set search_path = public as $$
declare inserted integer;
begin
  insert into public.credit_ledger (user_id, delta, reason, ref) values (p_user, p_amount, p_reason, p_ref)
  on conflict (ref) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return false; end if;
  update public.profiles set credits = credits + p_amount where id = p_user;
  return true;
end $$;

-- Ces fonctions ne sont appelables que par le serveur (service_role), jamais depuis le navigateur.
revoke all on function public.consume_credit(uuid, text) from public, anon, authenticated;
revoke all on function public.grant_credits(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.consume_credit(uuid, text) to service_role;
grant execute on function public.grant_credits(uuid, integer, text, text) to service_role;
