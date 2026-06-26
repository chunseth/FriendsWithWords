alter table public.scores
  add column if not exists board_tiles jsonb;
