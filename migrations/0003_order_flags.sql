-- Why a paid order did not go to print, or why it needs a human.
alter table orders add column if not exists failure_reason text;
