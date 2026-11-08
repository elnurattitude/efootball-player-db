-- Run this whole file in Supabase Dashboard > SQL Editor.
-- The tables are public-read only. Importing is performed separately from your own computer.

create table if not exists public.players (
  external_id text primary key,
  name text not null,
  nationality text,
  position text,
  team_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_cards (
  external_id text primary key,
  player_external_id text not null references public.players(external_id) on delete cascade,
  card_type text,
  overall_rating integer check (overall_rating between 1 and 150),
  playing_style text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists players_name_search_idx
  on public.players using gin (to_tsvector('simple', name));
create index if not exists players_position_idx on public.players(position);
create index if not exists cards_rating_idx on public.player_cards(overall_rating);

alter table public.players enable row level security;
alter table public.player_cards enable row level security;

drop policy if exists "Public can read players" on public.players;
create policy "Public can read players"
  on public.players for select to anon, authenticated using (true);

drop policy if exists "Public can read player cards" on public.player_cards;
create policy "Public can read player cards"
  on public.player_cards for select to anon, authenticated using (true);

grant select on public.players to anon, authenticated;
grant select on public.player_cards to anon, authenticated;

-- A read-only joined catalogue for the website.
create or replace view public.player_catalog
with (security_invoker = true) as
select
  c.external_id as card_external_id,
  p.external_id as player_external_id,
  p.name as player_name,
  p.nationality,
  p.position,
  p.team_name,
  c.card_type,
  c.overall_rating,
  c.playing_style
from public.player_cards c
join public.players p on p.external_id = c.player_external_id;

grant select on public.player_catalog to anon, authenticated;
