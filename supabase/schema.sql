create extension if not exists pgcrypto;

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  player_id text not null,
  display_name text not null,
  seed text not null,
  score_mode text not null default 'solo',
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

drop index if exists scores_player_seed_idx;
create unique index if not exists scores_player_seed_mode_idx
  on public.scores (player_id, seed, score_mode);

drop index if exists scores_seed_score_idx;
create index if not exists scores_seed_mode_score_idx
  on public.scores (seed, score_mode, final_score desc, completed_at asc);

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

create table if not exists public.multiplayer_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  mode_id text not null,
  seed text not null,
  status text not null default 'active',
  board_revision integer not null default 0,
  active_player_id text,
  participant_player_ids text[] not null default '{}',
  session_payload jsonb not null,
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists multiplayer_sessions_saved_at_idx
  on public.multiplayer_sessions (saved_at desc);

create index if not exists multiplayer_sessions_status_idx
  on public.multiplayer_sessions (status, saved_at desc);

alter table public.multiplayer_sessions enable row level security;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'multiplayer_sessions'
  ) then
    alter publication supabase_realtime add table public.multiplayer_sessions;
  end if;
end
$$;

drop policy if exists "multiplayer_sessions_read_authenticated" on public.multiplayer_sessions;
create policy "multiplayer_sessions_read_authenticated"
  on public.multiplayer_sessions
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists "multiplayer_sessions_insert_authenticated" on public.multiplayer_sessions;
create policy "multiplayer_sessions_insert_authenticated"
  on public.multiplayer_sessions
  for insert
  to authenticated
  with check (auth.uid() is not null);

drop policy if exists "multiplayer_sessions_update_authenticated" on public.multiplayer_sessions;
create policy "multiplayer_sessions_update_authenticated"
  on public.multiplayer_sessions
  for update
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_length_check
    check (char_length(username) between 3 and 20),
  constraint profiles_username_format_check
    check (username ~ '^[A-Za-z0-9_]+$'),
  constraint profiles_display_name_length_check
    check (char_length(display_name) between 3 and 20)
);

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

alter table public.profiles enable row level security;

drop policy if exists "profiles_read_all" on public.profiles;
create policy "profiles_read_all"
  on public.profiles
  for select
  using (true);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  receiver_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_requests_distinct_users_check
    check (sender_id <> receiver_id),
  constraint friend_requests_status_check
    check (status in ('pending', 'accepted', 'declined', 'canceled'))
);

create index if not exists friend_requests_sender_idx
  on public.friend_requests (sender_id, status, updated_at desc);

create index if not exists friend_requests_receiver_idx
  on public.friend_requests (receiver_id, status, updated_at desc);

create unique index if not exists friend_requests_pending_pair_idx
  on public.friend_requests (
    least(sender_id::text, receiver_id::text),
    greatest(sender_id::text, receiver_id::text)
  )
  where status = 'pending';

alter table public.friend_requests enable row level security;

drop policy if exists "friend_requests_read_participants" on public.friend_requests;
create policy "friend_requests_read_participants"
  on public.friend_requests
  for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "friend_requests_insert_sender" on public.friend_requests;
create policy "friend_requests_insert_sender"
  on public.friend_requests
  for insert
  to authenticated
  with check (auth.uid() = sender_id);

drop policy if exists "friend_requests_update_participants" on public.friend_requests;
create policy "friend_requests_update_participants"
  on public.friend_requests
  for update
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id)
  with check (auth.uid() = sender_id or auth.uid() = receiver_id);

create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  player_low_id uuid not null references auth.users (id) on delete cascade,
  player_high_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint friends_distinct_users_check
    check (player_low_id <> player_high_id)
);

create unique index if not exists friends_unique_pair_idx
  on public.friends (player_low_id, player_high_id);

create index if not exists friends_player_low_idx
  on public.friends (player_low_id, created_at desc);

create index if not exists friends_player_high_idx
  on public.friends (player_high_id, created_at desc);

alter table public.friends enable row level security;

drop policy if exists "friends_read_participants" on public.friends;
create policy "friends_read_participants"
  on public.friends
  for select
  to authenticated
  using (auth.uid() = player_low_id or auth.uid() = player_high_id);

drop policy if exists "friends_insert_participant" on public.friends;
create policy "friends_insert_participant"
  on public.friends
  for insert
  to authenticated
  with check (auth.uid() = player_low_id or auth.uid() = player_high_id);

create table if not exists public.multiplayer_game_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  receiver_id uuid not null references auth.users (id) on delete cascade,
  game_type text not null,
  seed text not null,
  status text not null default 'pending',
  session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint multiplayer_game_requests_distinct_users_check
    check (sender_id <> receiver_id),
  constraint multiplayer_game_requests_status_check
    check (status in ('pending', 'accepted', 'declined', 'canceled')),
  constraint multiplayer_game_requests_type_check
    check (game_type in ('daily', 'random', 'seeded'))
);

create index if not exists multiplayer_game_requests_sender_idx
  on public.multiplayer_game_requests (sender_id, status, updated_at desc);

create index if not exists multiplayer_game_requests_receiver_idx
  on public.multiplayer_game_requests (receiver_id, status, updated_at desc);

create index if not exists multiplayer_game_requests_session_idx
  on public.multiplayer_game_requests (session_id);

alter table public.multiplayer_game_requests enable row level security;

drop policy if exists "multiplayer_game_requests_read_participants" on public.multiplayer_game_requests;
create policy "multiplayer_game_requests_read_participants"
  on public.multiplayer_game_requests
  for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "multiplayer_game_requests_insert_sender" on public.multiplayer_game_requests;
create policy "multiplayer_game_requests_insert_sender"
  on public.multiplayer_game_requests
  for insert
  to authenticated
  with check (auth.uid() = sender_id);

drop policy if exists "multiplayer_game_requests_update_participants" on public.multiplayer_game_requests;
create policy "multiplayer_game_requests_update_participants"
  on public.multiplayer_game_requests
  for update
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id)
  with check (auth.uid() = sender_id or auth.uid() = receiver_id);

create or replace function public.delete_my_account_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  archived_sessions_count integer := 0;
  canceled_game_requests_count integer := 0;
  deleted_friend_requests_count integer := 0;
  deleted_friendships_count integer := 0;
  deleted_profiles_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  update public.multiplayer_sessions
  set
    status = 'archived',
    active_player_id = case
      when active_player_id = current_user_id::text then null
      else active_player_id
    end,
    participant_player_ids = array_remove(
      participant_player_ids,
      current_user_id::text
    ),
    session_payload = jsonb_set(
      jsonb_set(
        session_payload,
        '{status}',
        to_jsonb('archived'::text),
        true
      ),
      '{turn,activePlayerId}',
      'null'::jsonb,
      true
    ),
    saved_at = now(),
    updated_at = now()
  where current_user_id::text = any(participant_player_ids);

  get diagnostics archived_sessions_count = row_count;

  update public.multiplayer_game_requests
  set
    status = 'canceled',
    updated_at = now(),
    responded_at = coalesce(responded_at, now())
  where
    (sender_id = current_user_id or receiver_id = current_user_id)
    and status in ('pending', 'accepted');

  get diagnostics canceled_game_requests_count = row_count;

  delete from public.friend_requests
  where sender_id = current_user_id or receiver_id = current_user_id;

  get diagnostics deleted_friend_requests_count = row_count;

  delete from public.friends
  where
    player_low_id = current_user_id
    or player_high_id = current_user_id;

  get diagnostics deleted_friendships_count = row_count;

  delete from public.profiles
  where id = current_user_id;

  get diagnostics deleted_profiles_count = row_count;

  return jsonb_build_object(
    'archived_sessions_count',
    archived_sessions_count,
    'canceled_game_requests_count',
    canceled_game_requests_count,
    'deleted_friend_requests_count',
    deleted_friend_requests_count,
    'deleted_friendships_count',
    deleted_friendships_count,
    'deleted_profiles_count',
    deleted_profiles_count
  );
end;
$$;

grant execute on function public.delete_my_account_data() to authenticated;
