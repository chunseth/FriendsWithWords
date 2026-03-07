begin;

alter table public.scores
  add column if not exists time_bonus integer;

alter table public.scores
  add column if not exists perfection_bonus integer;

alter table public.scores
  add column if not exists consistency_bonus integer;

alter table public.scores
  add column if not exists skill_bonus_total integer;

alter table public.scores
  add column if not exists duration_seconds integer;

alter table public.scores
  add column if not exists invalid_word_attempts integer;

update public.scores
set time_bonus = 0
where time_bonus is null;

update public.scores
set perfection_bonus = 0
where perfection_bonus is null;

update public.scores
set consistency_bonus = 0
where consistency_bonus is null;

update public.scores
set skill_bonus_total = 0
where skill_bonus_total is null;

update public.scores
set invalid_word_attempts = 0
where invalid_word_attempts is null;

alter table public.scores
  alter column time_bonus set default 0;

alter table public.scores
  alter column perfection_bonus set default 0;

alter table public.scores
  alter column consistency_bonus set default 0;

alter table public.scores
  alter column skill_bonus_total set default 0;

alter table public.scores
  alter column invalid_word_attempts set default 0;

alter table public.scores
  alter column time_bonus set not null;

alter table public.scores
  alter column perfection_bonus set not null;

alter table public.scores
  alter column consistency_bonus set not null;

alter table public.scores
  alter column skill_bonus_total set not null;

alter table public.scores
  alter column invalid_word_attempts set not null;

commit;
