-- Street Royalty social layer: makers, follows, crowns, remix lineage, battles.
-- New tables only. Nothing here alters the studio tables, so the two can change apart.
-- Every write is scoped in server functions by the verified user id.

create table if not exists profiles (
  user_id text primary key,
  handle text not null unique,
  display_name text not null,
  bio text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists follows (
  follower_id text not null,
  maker_id text not null,
  created_at timestamptz not null default now(),
  primary key (follower_id, maker_id)
);
create index if not exists follows_maker_idx on follows (maker_id);

-- A crown is the like. One per person per piece.
create table if not exists crowns (
  user_id text not null,
  design_id text not null references designs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, design_id)
);
create index if not exists crowns_design_idx on crowns (design_id);

-- Who a remix came from. parent_id and root_id are not foreign keys on purpose:
-- credit outlives the original if its maker deletes it.
create table if not exists design_lineage (
  design_id text primary key references designs (id) on delete cascade,
  parent_id text not null,
  root_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists design_lineage_parent_idx on design_lineage (parent_id);
create index if not exists design_lineage_root_idx on design_lineage (root_id);

-- One vote per person per pair of pieces. pair_key is the two design ids, sorted, joined by ':'.
create table if not exists battle_votes (
  id text primary key,
  voter_id text not null,
  pair_key text not null,
  winner_id text not null references designs (id) on delete cascade,
  loser_id text not null references designs (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (voter_id, pair_key)
);
create index if not exists battle_votes_winner_idx on battle_votes (winner_id);
create index if not exists battle_votes_loser_idx on battle_votes (loser_id);
