drop policy if exists "multiplayer_sessions_read_authenticated" on public.multiplayer_sessions;
create policy "multiplayer_sessions_read_authenticated"
  on public.multiplayer_sessions
  for select
  to authenticated
  using (
    auth.uid() is not null
    and auth.uid()::text = any(participant_player_ids)
  );

drop policy if exists "multiplayer_sessions_insert_authenticated" on public.multiplayer_sessions;
create policy "multiplayer_sessions_insert_authenticated"
  on public.multiplayer_sessions
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and auth.uid()::text = any(participant_player_ids)
  );

drop policy if exists "multiplayer_sessions_update_authenticated" on public.multiplayer_sessions;
create policy "multiplayer_sessions_update_authenticated"
  on public.multiplayer_sessions
  for update
  to authenticated
  using (
    auth.uid() is not null
    and auth.uid()::text = any(participant_player_ids)
  )
  with check (
    auth.uid() is not null
    and auth.uid()::text = any(participant_player_ids)
  );

create or replace function public.accept_multiplayer_game_request(
  p_request_id uuid,
  p_session_id text,
  p_mode_id text,
  p_seed text,
  p_game_type text,
  p_active_player_id text,
  p_participant_player_ids text[],
  p_session_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  request_row public.multiplayer_game_requests%rowtype;
  requested_revision integer := coalesce((p_session_payload ->> 'boardRevision')::integer, 0);
begin
  if current_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'auth_failed');
  end if;

  if p_request_id is null
    or p_session_id is null
    or p_mode_id is null
    or p_seed is null
    or p_game_type is null
    or p_active_player_id is null
    or p_participant_player_ids is null
    or p_session_payload is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  end if;

  select *
  into request_row
  from public.multiplayer_game_requests
  where id = p_request_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'request_not_found');
  end if;

  if request_row.receiver_id <> current_user_id then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  if request_row.status <> 'pending' then
    return jsonb_build_object(
      'ok',
      false,
      'reason',
      'request_not_pending',
      'status',
      request_row.status
    );
  end if;

  if request_row.seed <> p_seed or request_row.game_type <> p_game_type then
    return jsonb_build_object('ok', false, 'reason', 'request_mismatch');
  end if;

  if not (request_row.sender_id::text = any(p_participant_player_ids))
    or not (request_row.receiver_id::text = any(p_participant_player_ids)) then
    return jsonb_build_object('ok', false, 'reason', 'participants_mismatch');
  end if;

  insert into public.multiplayer_sessions (
    session_id,
    mode_id,
    seed,
    status,
    board_revision,
    active_player_id,
    participant_player_ids,
    session_payload,
    saved_at
  )
  values (
    p_session_id,
    p_mode_id,
    p_seed,
    coalesce(p_session_payload ->> 'status', 'active'),
    requested_revision,
    p_active_player_id,
    p_participant_player_ids,
    p_session_payload,
    now()
  );

  update public.multiplayer_game_requests
  set
    status = 'accepted',
    session_id = p_session_id,
    responded_at = now(),
    updated_at = now()
  where id = p_request_id;

  return jsonb_build_object(
    'ok',
    true,
    'reason',
    'request_accepted',
    'session_id',
    p_session_id
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'session_id_conflict');
end;
$$;

create or replace function public.multiplayer_commit_turn(
  p_session_id text,
  p_expected_revision integer,
  p_action text,
  p_session_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id text := auth.uid()::text;
  current_session public.multiplayer_sessions%rowtype;
  next_revision integer;
  server_saved_at_ms bigint := floor(extract(epoch from now()) * 1000)::bigint;
  next_payload jsonb;
begin
  if current_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'auth_failed');
  end if;

  if p_session_id is null
    or p_expected_revision is null
    or p_action is null
    or p_session_payload is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  end if;

  select *
  into current_session
  from public.multiplayer_sessions
  where session_id = p_session_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'session_not_found');
  end if;

  if not (current_user_id = any(current_session.participant_player_ids)) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  if current_session.status <> 'active' then
    return jsonb_build_object(
      'ok',
      false,
      'reason',
      'session_not_active',
      'status',
      current_session.status
    );
  end if;

  if current_session.active_player_id is distinct from current_user_id then
    return jsonb_build_object(
      'ok',
      false,
      'reason',
      'not_active_player',
      'active_player_id',
      current_session.active_player_id
    );
  end if;

  if current_session.board_revision <> p_expected_revision then
    return jsonb_build_object(
      'ok',
      false,
      'reason',
      'revision_conflict',
      'current_revision',
      current_session.board_revision,
      'session',
      current_session.session_payload
    );
  end if;

  if p_action in ('finish_request', 'finish_accept', 'finish_decline') then
    if coalesce((p_session_payload #>> '{bag,remainingCount}')::integer, 1) <> 0 then
      return jsonb_build_object(
        'ok',
        false,
        'reason',
        'bag_not_empty'
      );
    end if;
  end if;

  next_revision := p_expected_revision + 1;
  next_payload := jsonb_set(
    jsonb_set(
      p_session_payload,
      '{boardRevision}',
      to_jsonb(next_revision),
      true
    ),
    '{savedAt}',
    to_jsonb(server_saved_at_ms),
    true
  );

  update public.multiplayer_sessions
  set
    session_payload = next_payload,
    board_revision = next_revision,
    status = coalesce(next_payload ->> 'status', status),
    active_player_id = coalesce(next_payload #>> '{turn,activePlayerId}', active_player_id),
    saved_at = now(),
    updated_at = now()
  where id = current_session.id;

  return jsonb_build_object(
    'ok',
    true,
    'reason',
    'turn_committed',
    'action',
    p_action,
    'session',
    next_payload
  );
end;
$$;

grant execute on function public.accept_multiplayer_game_request(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text[],
  jsonb
) to authenticated;

grant execute on function public.multiplayer_commit_turn(
  text,
  integer,
  text,
  jsonb
) to authenticated;
