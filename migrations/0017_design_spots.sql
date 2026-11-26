-- A regular piece can print on more than one spot (front, back, sleeves, legs).
-- spots_json holds every spot that has art, in print order:
--   [{ "placement": "front", "technique": "dtg", "layers": [...], "printFileId": "…" }, ...]
-- The first spot is mirrored into placement, layers_json and print_file_id, so
-- older readers still see the piece. Null means the row has only that one spot.
alter table designs add column if not exists spots_json text;
