-- The label's own launch pieces (src/lib/label). One row per piece the shop has
-- put on the rack, so each is made once, even with two servers starting together.
create table if not exists label_stock (
  piece_key text primary key,
  design_id text,
  created_at timestamptz not null default now()
);
