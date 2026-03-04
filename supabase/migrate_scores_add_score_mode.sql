begin;

alter table public.scores
  add column if not exists score_mode text;

update public.scores
set score_mode = 'solo'
where score_mode is null
   or btrim(score_mode) = '';

alter table public.scores
  alter column score_mode set default 'solo';

alter table public.scores
  alter column score_mode set not null;

alter table public.scores
  drop constraint if exists scores_score_mode_check;

alter table public.scores
  add constraint scores_score_mode_check
  check (score_mode in ('solo', 'multiplayer'));

drop index if exists public.scores_player_seed_idx;
create unique index if not exists scores_player_seed_mode_idx
  on public.scores (player_id, seed, score_mode);

drop index if exists public.scores_seed_score_idx;
create index if not exists scores_seed_mode_score_idx
  on public.scores (seed, score_mode, final_score desc, completed_at asc);

commit;
