create table if not exists public.push_delivery_queue (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.multiplayer_notifications (id) on delete cascade,
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_attempt_at timestamptz,
  last_error text,
  push_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_delivery_queue_status_check
    check (status in ('pending', 'processing', 'retry', 'sent', 'failed')),
  constraint push_delivery_queue_attempts_check
    check (attempts >= 0),
  constraint push_delivery_queue_max_attempts_check
    check (max_attempts >= 1),
  constraint push_delivery_queue_notification_unique
    unique (notification_id)
);

create index if not exists push_delivery_queue_status_next_idx
  on public.push_delivery_queue (status, next_attempt_at, created_at);

create index if not exists push_delivery_queue_recipient_idx
  on public.push_delivery_queue (recipient_user_id, created_at desc);

alter table public.push_delivery_queue enable row level security;

create or replace function public.enqueue_push_delivery_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type in (
    'friend_request',
    'game_request',
    'request_accepted',
    'turn_ready',
    'session_conflict',
    'reminder'
  ) then
    insert into public.push_delivery_queue (
      notification_id,
      recipient_user_id,
      type,
      entity_id,
      payload,
      next_attempt_at,
      updated_at
    )
    values (
      new.id,
      new.recipient_user_id,
      new.type,
      new.entity_id,
      coalesce(new.payload, '{}'::jsonb),
      now(),
      now()
    )
    on conflict (notification_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists multiplayer_notification_push_queue_trigger on public.multiplayer_notifications;
create trigger multiplayer_notification_push_queue_trigger
after insert on public.multiplayer_notifications
for each row
execute function public.enqueue_push_delivery_job();

create or replace function public.claim_push_delivery_jobs(
  p_limit integer default 50,
  p_worker_id text default null
)
returns table (
  id uuid,
  notification_id uuid,
  recipient_user_id uuid,
  type text,
  entity_id text,
  payload jsonb,
  attempts integer,
  max_attempts integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  claim_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
begin
  return query
  with candidates as (
    select q.id
    from public.push_delivery_queue q
    where (
      (q.status in ('pending', 'retry') and q.next_attempt_at <= now())
      or (q.status = 'processing' and q.locked_at <= now() - interval '10 minutes')
    )
      and q.attempts < q.max_attempts
    order by q.next_attempt_at asc, q.created_at asc
    limit claim_limit
    for update skip locked
  ), updated as (
    update public.push_delivery_queue q
    set
      status = 'processing',
      locked_at = now(),
      locked_by = coalesce(p_worker_id, 'push-worker'),
      last_attempt_at = now(),
      attempts = q.attempts + 1,
      updated_at = now()
    from candidates c
    where q.id = c.id
    returning
      q.id,
      q.notification_id,
      q.recipient_user_id,
      q.type,
      q.entity_id,
      q.payload,
      q.attempts,
      q.max_attempts
  )
  select * from updated;
end;
$$;

create or replace function public.complete_push_delivery_job(
  p_job_id uuid,
  p_success boolean,
  p_error text default null,
  p_push_result jsonb default null,
  p_retry_delay_seconds integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  job_row public.push_delivery_queue%rowtype;
  delay_seconds integer;
begin
  if p_job_id is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_payload');
  end if;

  select *
  into job_row
  from public.push_delivery_queue
  where id = p_job_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'job_not_found');
  end if;

  if coalesce(p_success, false) then
    update public.push_delivery_queue
    set
      status = 'sent',
      locked_at = null,
      locked_by = null,
      last_error = null,
      push_result = coalesce(p_push_result, '{}'::jsonb),
      updated_at = now()
    where id = job_row.id;

    return jsonb_build_object('ok', true, 'reason', 'sent');
  end if;

  delay_seconds := greatest(
    30,
    coalesce(
      p_retry_delay_seconds,
      (power(2::numeric, least(job_row.attempts, 8)) * 30)::integer
    )
  );

  if p_error = 'no_push_tokens' then
    update public.push_delivery_queue
    set
      status = 'retry',
      attempts = 0,
      locked_at = null,
      locked_by = null,
      next_attempt_at = now() + make_interval(secs => greatest(delay_seconds, 3600)),
      last_error = p_error,
      push_result = coalesce(p_push_result, '{}'::jsonb),
      updated_at = now()
    where id = job_row.id;

    return jsonb_build_object(
      'ok',
      true,
      'reason',
      'retry_scheduled_no_tokens',
      'delay_seconds',
      greatest(delay_seconds, 3600)
    );
  end if;

  if job_row.attempts >= job_row.max_attempts then
    update public.push_delivery_queue
    set
      status = 'failed',
      locked_at = null,
      locked_by = null,
      next_attempt_at = now(),
      last_error = coalesce(p_error, 'send_failed'),
      push_result = coalesce(p_push_result, '{}'::jsonb),
      updated_at = now()
    where id = job_row.id;

    return jsonb_build_object('ok', true, 'reason', 'failed_permanent');
  end if;

  update public.push_delivery_queue
  set
    status = 'retry',
    locked_at = null,
    locked_by = null,
    next_attempt_at = now() + make_interval(secs => delay_seconds),
    last_error = coalesce(p_error, 'send_failed'),
    push_result = coalesce(p_push_result, '{}'::jsonb),
    updated_at = now()
  where id = job_row.id;

  return jsonb_build_object(
    'ok',
    true,
    'reason',
    'retry_scheduled',
    'delay_seconds',
    delay_seconds
  );
end;
$$;

grant execute on function public.claim_push_delivery_jobs(integer, text) to service_role;
grant execute on function public.complete_push_delivery_job(uuid, boolean, text, jsonb, integer) to service_role;
grant select, insert, update on table public.push_delivery_queue to service_role;

insert into public.push_delivery_queue (
  notification_id,
  recipient_user_id,
  type,
  entity_id,
  payload,
  next_attempt_at,
  updated_at
)
select
  mn.id,
  mn.recipient_user_id,
  mn.type,
  mn.entity_id,
  coalesce(mn.payload, '{}'::jsonb),
  now(),
  now()
from public.multiplayer_notifications mn
where mn.type in (
  'friend_request',
  'game_request',
  'request_accepted',
  'turn_ready',
  'session_conflict',
  'reminder'
)
  and mn.created_at >= now() - interval '7 days'
on conflict (notification_id) do nothing;
