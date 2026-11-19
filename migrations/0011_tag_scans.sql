-- "Scan the fit": how many times a piece's tag was scanned out in the street.
-- One row per piece per UTC day. It is a counter for bragging, not a ledger.

create table if not exists tag_scans (
  design_id text not null references designs (id) on delete cascade,
  day text not null,
  scans integer not null default 0,
  primary key (design_id, day)
);
