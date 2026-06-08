-- Player Journal milestone unlocks for PalMaster Alpha 0.2.
-- Runtime remains storage-provider controlled; this migration only adds the
-- persistence table used by JSON/Supabase-compatible Journal logic.

create table public.player_journal_entries (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.guild_players(id) on delete cascade,
  journal_key text not null,
  category text not null,
  title text not null,
  metadata jsonb not null default '{}'::jsonb,
  unlocked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_journal_entries_player_key_unique unique (player_id, journal_key),
  constraint player_journal_entries_key_check check (length(trim(journal_key)) > 0),
  constraint player_journal_entries_category_check check (length(trim(category)) > 0),
  constraint player_journal_entries_title_check check (length(trim(title)) > 0)
);

create index player_journal_entries_player_unlocked_idx
  on public.player_journal_entries(player_id, unlocked_at desc);

create index player_journal_entries_key_idx
  on public.player_journal_entries(journal_key);

create trigger set_player_journal_entries_updated_at
before update on public.player_journal_entries
for each row execute function public.set_updated_at();
