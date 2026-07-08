-- Schéma Supabase pour DRAMÉ Gestion
-- À exécuter une fois dans : Supabase → SQL Editor → New query → coller → Run.
--
-- Principe : toutes les données de l'application (immeubles, locaux, locataires, paiements,
-- versements, dépenses, documents, rappels, paramètres) sont stockées ensemble dans un seul
-- objet JSON, une ligne par utilisateur. Simple, robuste, et suffisant pour ce volume.
-- La sécurité (RLS) garantit que chaque compte ne voit et ne modifie QUE ses propres données.

create table if not exists public.app_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Activer la sécurité au niveau des lignes.
alter table public.app_state enable row level security;

-- Chaque utilisateur ne peut lire/écrire que sa propre ligne (user_id = son identifiant).
drop policy if exists "app_state est privé à chaque utilisateur" on public.app_state;
create policy "app_state est privé à chaque utilisateur"
  on public.app_state
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
