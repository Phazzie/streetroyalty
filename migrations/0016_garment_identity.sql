-- Our garment id is permanent. Printer catalog ids stay in their own columns.
-- designs.provider_product_id already stores the Printful store product created
-- on publish, so the catalog blank id is provider_catalog_id, not that column.
--
-- Backfill:
--   template_id from garment_json.templateId, else the catalog number
--   (388/400/801) mapped to the template, else the sandbox product id
--   (placement blanks are their own template ids).
--   provider is printful when the stored product id is a catalog number,
--   sandbox otherwise.
--   provider_catalog_id is the product id that was stored.
--   provider_variant_id is the variant id that was stored.
-- The same four fields are filled on cart lines and on orders.items_json.
--
-- A before-write trigger fills the columns when an older instance inserts
-- without them, and puts garment_json back if that instance clears it on a
-- 388/400/801 or all-over row.

alter table designs add column if not exists template_id text;
alter table designs add column if not exists provider text;
alter table designs add column if not exists provider_catalog_id text;
alter table designs add column if not exists provider_variant_id text;

alter table cart_items add column if not exists template_id text;
alter table cart_items add column if not exists provider text;
alter table cart_items add column if not exists provider_catalog_id text;
alter table cart_items add column if not exists provider_variant_id text;

create or replace function sr_garment_template(product_id text, garment_json text)
returns text
language plpgsql
as $fn$
declare
  from_garment text;
begin
  if garment_json is not null and left(btrim(garment_json), 1) = '{' then
    begin
      from_garment := garment_json::json->>'templateId';
    exception when others then
      from_garment := null;
    end;
  end if;
  if from_garment = '388' then return 'aop-hoodie'; end if;
  if from_garment = '400' then return 'aop-joggers'; end if;
  if from_garment = '801' then return 'aop-track-jacket'; end if;
  if from_garment is not null and btrim(from_garment) <> '' then
    return from_garment;
  end if;
  -- 388, 400 and 801 are historical. They are the catalog numbers an older
  -- live save wrote into product_id or garment_json.templateId before this
  -- migration. New rows store the template id, so this list does not grow.
  if product_id = '388' then return 'aop-hoodie'; end if;
  if product_id = '400' then return 'aop-joggers'; end if;
  if product_id = '801' then return 'aop-track-jacket'; end if;
  return coalesce(nullif(product_id, ''), 'unknown');
end;
$fn$;

update designs
set
  template_id = sr_garment_template(product_id, garment_json),
  provider = case when product_id in ('388', '400', '801') then 'printful' else 'sandbox' end,
  provider_catalog_id = product_id,
  provider_variant_id = variant_id
where template_id is null;

alter table designs alter column template_id set not null;
alter table designs alter column provider set not null;

create or replace function designs_identity()
returns trigger
language plpgsql
as $fn$
begin
  if new.template_id is null or btrim(new.template_id) = '' then
    new.template_id := sr_garment_template(new.product_id, new.garment_json);
  end if;
  if new.provider is null or btrim(new.provider) = '' then
    new.provider := case
      when new.product_id in ('388', '400', '801') then 'printful'
      else 'sandbox'
    end;
  end if;
  if new.provider_catalog_id is null or btrim(new.provider_catalog_id) = '' then
    new.provider_catalog_id := new.product_id;
  end if;
  if new.provider_variant_id is null or btrim(new.provider_variant_id) = '' then
    new.provider_variant_id := new.variant_id;
  end if;
  -- An older instance writes garment_json = null for a catalog id it does not
  -- treat as all-over. The panels stay. template_id is what makes the row ours.
  if tg_op = 'UPDATE'
    and new.garment_json is null
    and old.garment_json is not null
    and (
      old.template_id in ('aop-hoodie', 'aop-joggers', 'aop-track-jacket')
      or new.template_id in ('aop-hoodie', 'aop-joggers', 'aop-track-jacket')
      or old.product_id in ('388', '400', '801', 'aop-hoodie', 'aop-joggers', 'aop-track-jacket')
      or new.product_id in ('388', '400', '801')
    )
  then
    new.garment_json := old.garment_json;
  end if;
  return new;
end;
$fn$;

drop trigger if exists designs_identity on designs;
create trigger designs_identity
before insert or update on designs
for each row execute function designs_identity();

update cart_items c
set
  template_id = d.template_id,
  provider = d.provider,
  provider_catalog_id = coalesce(d.provider_catalog_id, d.product_id),
  provider_variant_id = c.variant_id
from designs d
where d.id = c.design_id
  and c.template_id is null;

create or replace function cart_items_identity()
returns trigger
language plpgsql
as $fn$
declare
  parent_template text;
  parent_provider text;
  parent_catalog text;
begin
  select template_id, provider, coalesce(provider_catalog_id, product_id)
    into parent_template, parent_provider, parent_catalog
  from designs
  where id = new.design_id;
  if new.template_id is null or btrim(new.template_id) = '' then
    new.template_id := coalesce(parent_template, 'unknown');
  end if;
  if new.provider is null or btrim(new.provider) = '' then
    new.provider := coalesce(parent_provider, 'sandbox');
  end if;
  if new.provider_catalog_id is null or btrim(new.provider_catalog_id) = '' then
    new.provider_catalog_id := parent_catalog;
  end if;
  if new.provider_variant_id is null or btrim(new.provider_variant_id) = '' then
    new.provider_variant_id := new.variant_id;
  end if;
  return new;
end;
$fn$;

drop trigger if exists cart_items_identity on cart_items;
create trigger cart_items_identity
before insert or update on cart_items
for each row execute function cart_items_identity();

alter table cart_items alter column template_id set not null;
alter table cart_items alter column provider set not null;

do $do$
declare
  rec record;
  items jsonb;
  elem jsonb;
  rebuilt jsonb;
  design_id text;
  tpl text;
  prov text;
  catalog text;
  variant text;
begin
  for rec in select id, items_json from orders loop
    begin
      items := rec.items_json::jsonb;
    exception when others then
      continue;
    end;
    if jsonb_typeof(items) <> 'array' then
      continue;
    end if;
    rebuilt := '[]'::jsonb;
    for elem in select value from jsonb_array_elements(items) loop
      design_id := elem->>'designId';
      tpl := null;
      prov := null;
      catalog := null;
      variant := null;
      if design_id is not null then
        select d.template_id, d.provider, coalesce(d.provider_catalog_id, d.product_id),
               coalesce(d.provider_variant_id, elem->>'variantId')
          into tpl, prov, catalog, variant
        from designs d
        where d.id = design_id;
      end if;
      elem := elem || jsonb_strip_nulls(jsonb_build_object(
        'templateId', coalesce(elem->>'templateId', tpl),
        'provider', coalesce(elem->>'provider', prov),
        'providerCatalogId', coalesce(elem->>'providerCatalogId', catalog),
        'providerVariantId', coalesce(elem->>'providerVariantId', variant, elem->>'variantId')
      ));
      rebuilt := rebuilt || jsonb_build_array(elem);
    end loop;
    update orders set items_json = rebuilt::text where id = rec.id;
  end loop;
end;
$do$;
