-- All-over pieces are off sale (2026-11-26). Take published ones off the rack
-- and out of carts. They stay as the maker's drafts, and paid orders still print.
update designs
set status = 'draft'
where status = 'published'
  and (
    coalesce(template_id, '') in ('aop-hoodie', 'aop-joggers', 'aop-track-jacket')
    or product_id in ('aop-hoodie', 'aop-joggers', 'aop-track-jacket', '388', '400', '801')
  );

delete from cart_items
where coalesce(template_id, '') in ('aop-hoodie', 'aop-joggers', 'aop-track-jacket')
  or design_id in (
    select id from designs
    where coalesce(template_id, '') in ('aop-hoodie', 'aop-joggers', 'aop-track-jacket')
      or product_id in ('aop-hoodie', 'aop-joggers', 'aop-track-jacket', '388', '400', '801')
  );
