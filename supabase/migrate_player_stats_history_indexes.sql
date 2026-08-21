create index if not exists scores_player_mode_completed_idx
  on public.scores (player_id, score_mode, completed_at desc);

create index if not exists sprint_scores_player_completed_idx
  on public.sprint_scores (player_id, completed_at desc);

create index if not exists rush_scores_player_duration_completed_idx
  on public.rush_scores (player_id, duration_seconds, completed_at desc);

create index if not exists board_variant_scores_player_mode_completed_idx
  on public.board_variant_scores (player_id, mode_id, completed_at desc);
