-- Daily counters that cap how much image, video, and text generation the app will pay for.
-- A bucket is either 'global' or a one-day hash of a visitor's address. No account or
-- personal data is stored, and rows older than a week are deleted.

create table if not exists ai_usage (
  day text not null,
  bucket text not null,
  kind text not null,
  count integer not null default 0,
  primary key (day, bucket, kind)
);
