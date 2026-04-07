begin;

alter table public.scores
  drop column if exists perfection_bonus;

alter table public.scores
  drop column if exists invalid_word_attempts;

commit;
