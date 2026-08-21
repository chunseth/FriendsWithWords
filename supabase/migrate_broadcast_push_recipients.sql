create or replace function public.list_broadcast_push_recipients(
  p_limit integer default 100,
  p_offset integer default 0,
  p_user_ids uuid[] default null
)
returns table (user_id uuid)
language sql
security definer
set search_path = public
as $$
  select distinct pt.user_id
  from public.push_tokens pt
  where p_user_ids is null
    or pt.user_id = any(p_user_ids)
  order by pt.user_id
  limit greatest(1, least(coalesce(p_limit, 100), 500))
  offset greatest(0, coalesce(p_offset, 0));
$$;

grant execute on function public.list_broadcast_push_recipients(integer, integer, uuid[]) to service_role;
