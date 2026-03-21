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

update public.push_delivery_queue
set
  status = 'retry',
  attempts = 0,
  next_attempt_at = now() + interval '6 hours',
  last_error = 'no_push_tokens',
  updated_at = now()
where status = 'failed'
  and coalesce((push_result ->> 'attempted')::integer, 0) = 0;
