-- Reports: a person flags a piece or a maker, and the people who run the shop decide.
-- Nothing is hidden automatically. One report per person per target.

create table if not exists reports (
  id text primary key,
  reporter_id text not null,
  kind text not null,
  target_id text not null,
  reason text not null,
  note text not null default '',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text,
  unique (reporter_id, kind, target_id)
);
create index if not exists reports_status_idx on reports (status, created_at);
create index if not exists reports_target_idx on reports (kind, target_id);
