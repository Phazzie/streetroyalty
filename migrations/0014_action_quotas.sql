-- Per-person allowances for actions that cost storage or attention: remixes and reports.
-- One row per person, action and window. Taking one is a single statement that only
-- succeeds under the limit, so requests sent in parallel cannot slip past it.

create table if not exists action_quotas (
  user_id text not null,
  action text not null,
  window_key text not null,
  used integer not null default 0,
  primary key (user_id, action, window_key)
);
