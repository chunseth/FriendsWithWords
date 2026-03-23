create table if not exists public.board_variant_scores (
  id uuid primary key default gen_random_uuid(),
  player_id text not null,
  board_variant_id uuid not null,
  mode_id text not null default 'classic',
  display_name text not null,
  seed text not null,
  is_daily_seed boolean not null default true,
  final_score integer not null,
  points_earned integer not null,
  swap_penalties integer not null default 0,
  turn_penalties integer not null default 0,
  rack_penalty integer not null default 0,
  scrabble_bonus integer not null default 0,
  time_bonus integer not null default 0,
  perfection_bonus integer not null default 0,
  consistency_bonus integer not null default 0,
  skill_bonus_total integer not null default 0,
  duration_seconds integer,
  invalid_word_attempts integer not null default 0,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint board_variant_scores_mode_check
    check (mode_id in ('classic', 'mini'))
);

create unique index if not exists board_variant_scores_player_variant_mode_idx
  on public.board_variant_scores (player_id, board_variant_id, mode_id);

create index if not exists board_variant_scores_variant_mode_score_idx
  on public.board_variant_scores (board_variant_id, mode_id, final_score desc, completed_at asc);

alter table public.board_variant_scores enable row level security;

drop policy if exists "board_variant_scores_read_all" on public.board_variant_scores;
create policy "board_variant_scores_read_all"
  on public.board_variant_scores
  for select
  using (true);

drop policy if exists "board_variant_scores_insert_authenticated_self" on public.board_variant_scores;
create policy "board_variant_scores_insert_authenticated_self"
  on public.board_variant_scores
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and player_id = auth.uid()::text
  );

drop policy if exists "board_variant_scores_update_authenticated_self" on public.board_variant_scores;
create policy "board_variant_scores_update_authenticated_self"
  on public.board_variant_scores
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

alter table public.multiplayer_sessions
  add column if not exists board_variant_id uuid;

create index if not exists multiplayer_sessions_board_variant_idx
  on public.multiplayer_sessions (board_variant_id, saved_at desc);

drop policy if exists "layout_lab_saved_layouts_read_own" on public.layout_lab_saved_layouts;
drop policy if exists "layout_lab_saved_layouts_read_authenticated" on public.layout_lab_saved_layouts;
create policy "layout_lab_saved_layouts_read_authenticated"
  on public.layout_lab_saved_layouts
  for select
  to authenticated
  using (auth.uid() is not null);
