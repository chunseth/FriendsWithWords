create or replace function public.handle_multiplayer_session_turn_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and old.active_player_id is distinct from new.active_player_id
    and new.active_player_id is not null
    and new.status = 'active' then
    perform public.enqueue_multiplayer_notification(
      new.active_player_id::uuid,
      'turn_ready',
      new.session_id,
      jsonb_build_object(
        'sessionId',
        new.session_id,
        'friendId',
        old.active_player_id,
        'route',
        'multiplayer',
        'version',
        1
      )
    );
  end if;

  return new;
end;
$$;
