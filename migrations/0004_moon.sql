-- Moon level: fork credit on designs, drop dates on collections.
-- A fork keeps the originator's title as baked-in credit. A collection
-- with a drop_at is a Drop that opens on that date.

alter table designs add column if not exists forked_from_title text;
alter table collections add column if not exists drop_at timestamptz;
