-- Multiplayer notifications, presence, session-state, and reminder infrastructure.
-- Mirrors the canonical definitions in supabase/schema.sql.

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null,
  provider text not null,
  token text not null,
  device_id text not null,
  app_build text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_tokens_platform_check
    check (platform in ('ios', 'android')),
  constraint push_tokens_provider_check
    check (provider in ('apns', 'fcm'))
);
create unique index if not exists push_tokens_user_device_token_idx
  on public.push_tokens (user_id, device_id, token);
create index if not exists push_tokens_user_updated_idx
  on public.push_tokens (user_id, updated_at desc);
alter table public.push_tokens enable row level security;
drop policy if exists "push_tokens_read_self" on public.push_tokens;
create policy "push_tokens_read_self" on public.push_tokens for select to authenticated using (auth.uid() = user_id);
drop policy if exists "push_tokens_insert_self" on public.push_tokens;
create policy "push_tokens_insert_self" on public.push_tokens for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "push_tokens_update_self" on public.push_tokens;
create policy "push_tokens_update_self" on public.push_tokens for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.multiplayer_user_session_state (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.multiplayer_sessions (session_id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_seen_revision integer not null default 0,
  last_opened_at timestamptz,
  muted_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists multiplayer_user_session_state_unique_idx
  on public.multiplayer_user_session_state (session_id, user_id);
create index if not exists multiplayer_user_session_state_user_idx
  on public.multiplayer_user_session_state (user_id, updated_at desc);
alter table public.multiplayer_user_session_state enable row level security;
drop policy if exists "multiplayer_user_session_state_read_self_participant" on public.multiplayer_user_session_state;
create policy "multiplayer_user_session_state_read_self_participant"
  on public.multiplayer_user_session_state
  for select
  to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.multiplayer_sessions ms
      where ms.session_id = multiplayer_user_session_state.session_id
      and auth.uid()::text = any(ms.participant_player_ids)
    )
  );
drop policy if exists "multiplayer_user_session_state_insert_self_participant" on public.multiplayer_user_session_state;
create policy "multiplayer_user_session_state_insert_self_participant"
  on public.multiplayer_user_session_state
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.multiplayer_sessions ms
      where ms.session_id = multiplayer_user_session_state.session_id
      and auth.uid()::text = any(ms.participant_player_ids)
    )
  );
drop policy if exists "multiplayer_user_session_state_update_self_participant" on public.multiplayer_user_session_state;
create policy "multiplayer_user_session_state_update_self_participant"
  on public.multiplayer_user_session_state
  for update
  to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.multiplayer_sessions ms
      where ms.session_id = multiplayer_user_session_state.session_id
      and auth.uid()::text = any(ms.participant_player_ids)
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.multiplayer_sessions ms
      where ms.session_id = multiplayer_user_session_state.session_id
      and auth.uid()::text = any(ms.participant_player_ids)
    )
  );

create table if not exists public.multiplayer_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint multiplayer_notifications_type_check
    check (
      type in (
        'friend_request','game_request','request_accepted','turn_ready','session_conflict','reminder'
      )
    )
);
create index if not exists multiplayer_notifications_recipient_unread_idx
  on public.multiplayer_notifications (recipient_user_id, read_at, created_at desc);
create index if not exists multiplayer_notifications_entity_idx
  on public.multiplayer_notifications (entity_id, created_at desc);
alter table public.multiplayer_notifications enable row level security;
drop policy if exists "multiplayer_notifications_read_self" on public.multiplayer_notifications;
create policy "multiplayer_notifications_read_self" on public.multiplayer_notifications for select to authenticated using (auth.uid() = recipient_user_id);
drop policy if exists "multiplayer_notifications_update_self" on public.multiplayer_notifications;
create policy "multiplayer_notifications_update_self" on public.multiplayer_notifications for update to authenticated using (auth.uid() = recipient_user_id) with check (auth.uid() = recipient_user_id);

create table if not exists public.user_presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'online',
  last_active_at timestamptz not null default now(),
  last_session_id text,
  updated_at timestamptz not null default now(),
  constraint user_presence_status_check check (status in ('online', 'away', 'offline'))
);
alter table public.user_presence enable row level security;
drop policy if exists "user_presence_read_all" on public.user_presence;
create policy "user_presence_read_all" on public.user_presence for select to authenticated using (true);
drop policy if exists "user_presence_write_self" on public.user_presence;
create policy "user_presence_write_self" on public.user_presence for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.enqueue_multiplayer_notification(
  p_recipient_user_id uuid,
  p_type text,
  p_entity_id text default null,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_id uuid;
begin
  if p_recipient_user_id is null or p_type is null then
    return null;
  end if;
  insert into public.multiplayer_notifications (recipient_user_id, type, entity_id, payload)
  values (p_recipient_user_id, p_type, p_entity_id, coalesce(p_payload, '{}'::jsonb))
  returning id into notification_id;
  return notification_id;
end;
$$;

create or replace function public.register_push_token(
  p_platform text,
  p_provider text,
  p_token text,
  p_device_id text,
  p_app_build text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'auth_failed');
  end if;
  insert into public.push_tokens (user_id, platform, provider, token, device_id, app_build, last_seen_at, updated_at)
  values (current_user_id, p_platform, p_provider, p_token, p_device_id, p_app_build, now(), now())
  on conflict (user_id, device_id, token)
  do update set
    platform = excluded.platform,
    provider = excluded.provider,
    app_build = excluded.app_build,
    last_seen_at = now(),
    updated_at = now();
  return jsonb_build_object('ok', true, 'reason', 'token_registered');
end;
$$;

create or replace function public.upsert_presence(
  p_status text,
  p_last_session_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'auth_failed');
  end if;
  insert into public.user_presence (user_id, status, last_active_at, last_session_id, updated_at)
  values (current_user_id, coalesce(p_status, 'online'), now(), p_last_session_id, now())
  on conflict (user_id)
  do update set
    status = coalesce(p_status, user_presence.status),
    last_active_at = now(),
    last_session_id = coalesce(p_last_session_id, user_presence.last_session_id),
    updated_at = now();
  return jsonb_build_object('ok', true, 'reason', 'presence_updated');
end;
$$;

create or replace function public.mark_multiplayer_notifications_read(p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  updated_count integer := 0;
begin
  if current_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'auth_failed');
  end if;
  update public.multiplayer_notifications
  set read_at = now()
  where id = any(coalesce(p_ids, '{}'))
    and recipient_user_id = current_user_id
    and read_at is null;
  get diagnostics updated_count = row_count;
  return jsonb_build_object('ok', true, 'updated_count', updated_count);
end;
$$;

create or replace function public.mark_session_seen(p_session_id text, p_seen_revision integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'auth_failed');
  end if;
  if not exists (
    select 1 from public.multiplayer_sessions ms
    where ms.session_id = p_session_id
      and current_user_id::text = any(ms.participant_player_ids)
  ) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  insert into public.multiplayer_user_session_state (session_id, user_id, last_seen_revision, last_opened_at, updated_at)
  values (p_session_id, current_user_id, greatest(coalesce(p_seen_revision, 0), 0), now(), now())
  on conflict (session_id, user_id)
  do update set
    last_seen_revision = greatest(multiplayer_user_session_state.last_seen_revision, greatest(coalesce(p_seen_revision, 0), 0)),
    last_opened_at = now(),
    updated_at = now();
  return jsonb_build_object('ok', true, 'reason', 'session_seen_marked');
end;
$$;

create or replace function public.archive_multiplayer_session_for_user(p_session_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'auth_failed');
  end if;
  update public.multiplayer_sessions
  set status = 'archived',
      session_payload = jsonb_set(session_payload, '{status}', to_jsonb('archived'::text), true),
      saved_at = now(),
      updated_at = now()
  where session_id = p_session_id
    and current_user_id::text = any(participant_player_ids);
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'session_not_found');
  end if;
  return jsonb_build_object('ok', true, 'reason', 'session_archived');
end;
$$;

create or replace function public.create_multiplayer_rematch(
  p_session_id text,
  p_new_session_id text,
  p_seed text,
  p_game_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  source_session public.multiplayer_sessions%rowtype;
begin
  if current_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'auth_failed');
  end if;
  select * into source_session from public.multiplayer_sessions where session_id = p_session_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'session_not_found');
  end if;
  if not (current_user_id::text = any(source_session.participant_player_ids)) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  insert into public.multiplayer_sessions (
    session_id, mode_id, seed, status, board_revision, active_player_id, participant_player_ids, session_payload, saved_at
  ) values (
    p_new_session_id, source_session.mode_id, p_seed, 'active', 0, source_session.participant_player_ids[1], source_session.participant_player_ids,
    jsonb_build_object('schemaVersion', 1, 'modeId', source_session.mode_id, 'sessionId', p_new_session_id, 'seed', p_seed, 'gameType', coalesce(p_game_type, 'seeded'), 'status', 'active', 'boardRevision', 0, 'savedAt', floor(extract(epoch from now()) * 1000)::bigint),
    now()
  );
  return jsonb_build_object('ok', true, 'reason', 'rematch_created', 'session_id', p_new_session_id);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'session_id_conflict');
end;
$$;

grant execute on function public.enqueue_multiplayer_notification(uuid, text, text, jsonb) to authenticated;
grant execute on function public.register_push_token(text, text, text, text, text) to authenticated;
grant execute on function public.upsert_presence(text, text) to authenticated;
grant execute on function public.mark_multiplayer_notifications_read(uuid[]) to authenticated;
grant execute on function public.mark_session_seen(text, integer) to authenticated;
grant execute on function public.archive_multiplayer_session_for_user(text) to authenticated;
grant execute on function public.create_multiplayer_rematch(text, text, text, text) to authenticated;

create table if not exists public.multiplayer_user_notification_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  turn_reminders_enabled boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  timezone text,
  updated_at timestamptz not null default now()
);

alter table public.multiplayer_user_notification_settings enable row level security;
drop policy if exists "multiplayer_notification_settings_read_self" on public.multiplayer_user_notification_settings;
create policy "multiplayer_notification_settings_read_self"
  on public.multiplayer_user_notification_settings
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "multiplayer_notification_settings_insert_self" on public.multiplayer_user_notification_settings;
create policy "multiplayer_notification_settings_insert_self"
  on public.multiplayer_user_notification_settings
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "multiplayer_notification_settings_update_self" on public.multiplayer_user_notification_settings;
create policy "multiplayer_notification_settings_update_self"
  on public.multiplayer_user_notification_settings
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.get_multiplayer_notification_settings()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  settings_row public.multiplayer_user_notification_settings%rowtype;
begin
  if current_user_id is null then
    return null;
  end if;

  select *
  into settings_row
  from public.multiplayer_user_notification_settings
  where user_id = current_user_id;

  if not found then
    return jsonb_build_object(
      'user_id', current_user_id,
      'turn_reminders_enabled', true,
      'quiet_hours_start', null,
      'quiet_hours_end', null,
      'timezone', null
    );
  end if;

  return jsonb_build_object(
    'user_id', settings_row.user_id,
    'turn_reminders_enabled', settings_row.turn_reminders_enabled,
    'quiet_hours_start', settings_row.quiet_hours_start,
    'quiet_hours_end', settings_row.quiet_hours_end,
    'timezone', settings_row.timezone
  );
end;
$$;

create or replace function public.upsert_multiplayer_notification_settings(
  p_turn_reminders_enabled boolean default true,
  p_quiet_hours_start time default null,
  p_quiet_hours_end time default null,
  p_timezone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    return null;
  end if;

  insert into public.multiplayer_user_notification_settings (
    user_id,
    turn_reminders_enabled,
    quiet_hours_start,
    quiet_hours_end,
    timezone,
    updated_at
  )
  values (
    current_user_id,
    coalesce(p_turn_reminders_enabled, true),
    p_quiet_hours_start,
    p_quiet_hours_end,
    p_timezone,
    now()
  )
  on conflict (user_id)
  do update set
    turn_reminders_enabled = coalesce(
      p_turn_reminders_enabled,
      multiplayer_user_notification_settings.turn_reminders_enabled
    ),
    quiet_hours_start = p_quiet_hours_start,
    quiet_hours_end = p_quiet_hours_end,
    timezone = p_timezone,
    updated_at = now();

  return public.get_multiplayer_notification_settings();
end;
$$;

create or replace function public.set_session_reminder_mute(
  p_session_id text,
  p_muted_until timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'auth_failed');
  end if;

  if p_session_id is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  end if;

  if not exists (
    select 1
    from public.multiplayer_sessions ms
    where ms.session_id = p_session_id
      and current_user_id::text = any(ms.participant_player_ids)
  ) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  insert into public.multiplayer_user_session_state (
    session_id,
    user_id,
    last_seen_revision,
    muted_until,
    updated_at
  )
  values (
    p_session_id,
    current_user_id,
    0,
    p_muted_until,
    now()
  )
  on conflict (session_id, user_id)
  do update set
    muted_until = p_muted_until,
    updated_at = now();

  return jsonb_build_object('ok', true, 'reason', 'session_mute_updated');
end;
$$;

create or replace function public.enqueue_turn_reminders()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  with candidates as (
    select
      ms.session_id,
      ms.active_player_id::uuid as recipient_user_id
    from public.multiplayer_sessions ms
    left join public.multiplayer_user_session_state mus
      on mus.session_id = ms.session_id
      and mus.user_id::text = ms.active_player_id
    left join public.multiplayer_user_notification_settings muns
      on muns.user_id::text = ms.active_player_id
    where ms.status = 'active'
      and ms.active_player_id is not null
      and ms.saved_at < now() - interval '12 hours'
      and (mus.muted_until is null or mus.muted_until < now())
      and coalesce(muns.turn_reminders_enabled, true)
      and (
        muns.quiet_hours_start is null
        or muns.quiet_hours_end is null
        or (
          case
            when muns.quiet_hours_start <= muns.quiet_hours_end
              then not ((now() at time zone coalesce(muns.timezone, 'UTC'))::time >= muns.quiet_hours_start
                and (now() at time zone coalesce(muns.timezone, 'UTC'))::time < muns.quiet_hours_end)
            else not ((now() at time zone coalesce(muns.timezone, 'UTC'))::time >= muns.quiet_hours_start
              or (now() at time zone coalesce(muns.timezone, 'UTC'))::time < muns.quiet_hours_end)
          end
        )
      )
      and not exists (
        select 1
        from public.multiplayer_notifications mn
        where mn.recipient_user_id::text = ms.active_player_id
          and mn.type = 'reminder'
          and mn.entity_id = ms.session_id
          and mn.created_at > now() - interval '24 hours'
      )
  ), inserted as (
    insert into public.multiplayer_notifications (
      recipient_user_id,
      type,
      entity_id,
      payload
    )
    select
      c.recipient_user_id,
      'reminder',
      c.session_id,
      jsonb_build_object('sessionId', c.session_id, 'version', 1)
    from candidates c
    returning id
  )
  select count(*)::integer into inserted_count from inserted;

  return jsonb_build_object('ok', true, 'inserted_count', inserted_count);
end;
$$;

grant execute on function public.get_multiplayer_notification_settings() to authenticated;
grant execute on function public.upsert_multiplayer_notification_settings(boolean, time, time, text) to authenticated;
grant execute on function public.set_session_reminder_mute(text, timestamptz) to authenticated;
grant execute on function public.enqueue_turn_reminders() to authenticated;
