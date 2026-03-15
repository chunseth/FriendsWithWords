-- Ensure realtime publication includes friend + multiplayer inbox tables.

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and to_regclass('public.friend_requests') is not null and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'friend_requests'
  ) then
    alter publication supabase_realtime add table public.friend_requests;
  end if;

  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and to_regclass('public.multiplayer_notifications') is not null and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'multiplayer_notifications'
  ) then
    alter publication supabase_realtime add table public.multiplayer_notifications;
  end if;

  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and to_regclass('public.multiplayer_game_requests') is not null and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'multiplayer_game_requests'
  ) then
    alter publication supabase_realtime add table public.multiplayer_game_requests;
  end if;
end
$$;
