-- Street Royalty studio: designs, collections, cart, and print orders.
-- Per-user rows are scoped in server functions by the verified user id.

create table if not exists collections (
  id text primary key,
  user_id text not null,
  name text not null,
  created_at timestamptz not null default now()
);
create index if not exists collections_user_idx on collections (user_id);

create table if not exists print_files (
  id text primary key,
  user_id text not null,
  mime text not null,
  data_base64 text not null,
  created_at timestamptz not null default now()
);

create table if not exists designs (
  id text primary key,
  user_id text not null,
  collection_id text references collections (id) on delete set null,
  title text not null,
  slug text not null unique,
  status text not null default 'draft',
  product_id text not null,
  product_name text not null,
  product_type text not null,
  variant_id text not null,
  variant_label text not null,
  color_name text not null,
  color_hex text not null,
  size_label text not null,
  placement text not null,
  technique text not null,
  layers_json text not null,
  print_file_id text,
  mockup_url text,
  retail_cents integer not null,
  currency text not null default 'USD',
  provider_product_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists designs_user_idx on designs (user_id);
create index if not exists designs_status_idx on designs (status);

create table if not exists cart_items (
  id text primary key,
  user_id text not null,
  design_id text not null references designs (id) on delete cascade,
  variant_id text not null,
  variant_label text not null,
  quantity integer not null default 1,
  created_at timestamptz not null default now(),
  unique (user_id, design_id, variant_id)
);
create index if not exists cart_items_user_idx on cart_items (user_id);

create table if not exists orders (
  id text primary key,
  user_id text not null,
  status text not null,
  currency text not null default 'USD',
  subtotal_cents integer not null,
  shipping_cents integer not null,
  total_cents integer not null,
  shipping_method text not null,
  recipient_json text not null,
  items_json text not null,
  provider text not null,
  provider_order_id text,
  provider_status text,
  payment_provider text,
  payment_session_id text,
  payment_status text not null default 'unpaid',
  tracking_number text,
  tracking_url text,
  sandbox boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_user_idx on orders (user_id);
create index if not exists orders_provider_idx on orders (provider_order_id);

create table if not exists webhook_events (
  id text primary key,
  provider text not null,
  event_type text not null,
  created_at timestamptz not null default now()
);
