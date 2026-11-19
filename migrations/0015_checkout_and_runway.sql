-- One open checkout per account and cart, so a retry does not open a second draft.
-- The claim is taken before the printer is called. It is removed if that start fails.

create table if not exists checkout_claims (
  user_id text not null,
  idempotency_key text not null,
  order_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, idempotency_key)
);

alter table orders add column if not exists idempotency_key text;
alter table orders add column if not exists checkout_url text;

-- A runway video belongs to the account (or the address, for the shared dev user) that started it.
create table if not exists runway_runs (
  request_id text primary key,
  owner_key text not null,
  created_at timestamptz not null default now()
);
