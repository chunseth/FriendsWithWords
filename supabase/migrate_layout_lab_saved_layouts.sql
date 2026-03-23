begin;

create extension if not exists pgcrypto;

create table if not exists public.layout_lab_saved_layouts (
  id uuid primary key default gen_random_uuid(),
  player_id text not null,
  mode_id text not null,
  layout_name text not null,
  seed text,
  board_size integer not null,
  premium_squares jsonb not null default '{}'::jsonb,
  tile_counts jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint layout_lab_saved_layouts_mode_check
    check (mode_id in ('classic', 'mini'))
);

create index if not exists layout_lab_saved_layouts_player_saved_idx
  on public.layout_lab_saved_layouts (player_id, saved_at desc);

create index if not exists layout_lab_saved_layouts_mode_saved_idx
  on public.layout_lab_saved_layouts (mode_id, saved_at desc);

alter table public.layout_lab_saved_layouts enable row level security;

drop policy if exists "layout_lab_saved_layouts_read_own" on public.layout_lab_saved_layouts;
create policy "layout_lab_saved_layouts_read_own"
  on public.layout_lab_saved_layouts
  for select
  to authenticated
  using (
    auth.uid() is not null
    and player_id = auth.uid()::text
  );

drop policy if exists "layout_lab_saved_layouts_insert_own" on public.layout_lab_saved_layouts;
create policy "layout_lab_saved_layouts_insert_own"
  on public.layout_lab_saved_layouts
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and player_id = auth.uid()::text
  );

drop policy if exists "layout_lab_saved_layouts_update_own" on public.layout_lab_saved_layouts;
create policy "layout_lab_saved_layouts_update_own"
  on public.layout_lab_saved_layouts
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

commit;

