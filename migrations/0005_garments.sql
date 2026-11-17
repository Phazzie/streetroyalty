-- All-over garments: panel designs, colorways, and matched sets.
-- colorway_id defaults to '' so the existing cart unique key still matches one line per size.

alter table designs add column if not exists garment_json text;
alter table designs add column if not exists set_id text;

alter table cart_items add column if not exists colorway_id text not null default '';

create table if not exists garment_sets (
  id text primary key,
  user_id text not null,
  title text not null,
  slug text not null unique,
  status text not null default 'draft',
  provider text not null,
  colorways_json text not null,
  piece_ids_json text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists garment_sets_user_idx on garment_sets (user_id);
create index if not exists designs_set_idx on designs (set_id);
