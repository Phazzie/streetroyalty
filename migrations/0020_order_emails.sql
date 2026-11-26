-- When each order email went out, so a webhook that arrives twice never sends it twice.
alter table orders add column if not exists emailed_placed_at timestamptz;
alter table orders add column if not exists emailed_shipped_at timestamptz;
