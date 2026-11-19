-- A cart line is one piece, one size and one colourway. Before this, the same piece in
-- the same size but a second colourway merged into the first line and overwrote its
-- colourway. Existing rows all have colorway_id '' from 0005, so they stay unique.

alter table cart_items drop constraint if exists cart_items_user_id_design_id_variant_id_key;
create unique index if not exists cart_items_line_key
  on cart_items (user_id, design_id, variant_id, colorway_id);
