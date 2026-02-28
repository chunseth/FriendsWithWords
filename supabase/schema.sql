create extension if not exists pgcrypto;

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  player_id text not null,
  display_name text not null,
  seed text not null,
  is_daily_seed boolean not null default false,
  final_score integer not null,
  points_earned integer not null,
  swap_penalties integer not null default 0,
  turn_penalties integer not null default 0,
  rack_penalty integer not null default 0,
  scrabble_bonus integer not null default 0,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists scores_player_seed_idx
  on public.scores (player_id, seed);

create index if not exists scores_seed_score_idx
  on public.scores (seed, final_score desc, completed_at asc);

alter table public.scores enable row level security;

drop policy if exists "scores_read_all" on public.scores;
create policy "scores_read_all"
  on public.scores
  for select
  using (true);

drop policy if exists "scores_insert_authenticated_self" on public.scores;
drop policy if exists "scores_insert_all" on public.scores;
create policy "scores_insert_authenticated_self"
  on public.scores
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and player_id = auth.uid()::text
  );

drop policy if exists "scores_update_authenticated_self" on public.scores;
drop policy if exists "scores_update_same_player_seed" on public.scores;
create policy "scores_update_authenticated_self"
  on public.scores
  for update
  to authenticated
  using (
    auth.uid() is not null
    and player_id = auth.uid()::text
  )
  with check (
    auth.uid() is not null
    and player_id = auth.uid()::text
  );
