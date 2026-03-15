-- Allow participants to delete friendship rows so "Unadd Friend" persists.

alter table public.friends enable row level security;

drop policy if exists "friends_delete_participant" on public.friends;
create policy "friends_delete_participant"
  on public.friends
  for delete
  to authenticated
  using (auth.uid() = player_low_id or auth.uid() = player_high_id);
