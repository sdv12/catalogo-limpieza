-- ============================================================
-- Etapa 2 · fix — search_products
-- Los nombres de las columnas de RETURNS TABLE (low_stock, is_deleted…)
-- chocaban con columnas de las CTE. `#variable_conflict use_column`
-- hace que las referencias ambiguas resuelvan a la columna.
-- ============================================================

create or replace function public.search_products(
  p_catalog_id      uuid,
  p_q               text default null,
  p_category_id     uuid default null,
  p_status          text default null,
  p_stock           text default null,
  p_include_deleted boolean default false,
  p_sort            text default 'updated_at',
  p_dir             text default 'desc',
  p_limit           integer default 25,
  p_offset          integer default 0
)
returns table (
  id            uuid,
  name          text,
  brand         text,
  base_sku      text,
  status        text,
  is_deleted    boolean,
  updated_at    timestamptz,
  category_name text,
  variant_count bigint,
  total_stock   numeric,
  low_stock     boolean,
  min_price     numeric,
  max_price     numeric,
  primary_image text,
  total_count   bigint
)
language plpgsql
stable
security invoker
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_catalog_member(p_catalog_id) then
    raise exception 'Sin acceso a este catálogo' using errcode = '42501';
  end if;

  return query
  with base as (
    select
      p.id, p.name, p.brand, p.base_sku, p.status, p.is_deleted,
      p.created_at, p.updated_at,
      cat.name as category_name,
      (select count(*) from public.product_variants v
         where v.product_id = p.id and v.is_deleted = false) as variant_count,
      (select coalesce(sum(v.stock), 0) from public.product_variants v
         where v.product_id = p.id and v.is_deleted = false) as total_stock,
      coalesce((select bool_or(v.stock < v.min_stock) from public.product_variants v
         where v.product_id = p.id and v.is_deleted = false), false) as low_stock,
      (select min(vp.price) from public.variant_prices vp
         join public.product_variants v on v.id = vp.variant_id and v.is_deleted = false
         where v.product_id = p.id) as min_price,
      (select max(vp.price) from public.variant_prices vp
         join public.product_variants v on v.id = vp.variant_id and v.is_deleted = false
         where v.product_id = p.id) as max_price,
      (select i.storage_path from public.product_images i
         where i.product_id = p.id
         order by i.is_primary desc, i.position asc limit 1) as primary_image
    from public.products p
    left join public.categories cat on cat.id = p.primary_category_id
    where p.catalog_id = p_catalog_id
      and (p_include_deleted or p.is_deleted = false)
      and (p_status is null or p.status = p_status)
      and (
        p_category_id is null
        or p.primary_category_id = p_category_id
        or exists (select 1 from public.product_categories pc
                   where pc.product_id = p.id and pc.category_id = p_category_id)
      )
      and (
        p_q is null
        or p.name ilike '%' || p_q || '%'
        or p.base_sku ilike '%' || p_q || '%'
        or exists (select 1 from public.product_variants v
                   where v.product_id = p.id and v.sku ilike '%' || p_q || '%')
      )
  ),
  filtered as (
    select * from base b
    where p_stock is null
       or (p_stock = 'low' and b.low_stock)
       or (p_stock = 'ok'  and not b.low_stock)
  )
  select
    f.id, f.name, f.brand, f.base_sku, f.status, f.is_deleted, f.updated_at,
    f.category_name, f.variant_count, f.total_stock, f.low_stock,
    f.min_price, f.max_price, f.primary_image,
    count(*) over () as total_count
  from filtered f
  order by
    case when p_sort = 'name'       and p_dir = 'asc'  then f.name       end asc  nulls last,
    case when p_sort = 'name'       and p_dir = 'desc' then f.name       end desc nulls last,
    case when p_sort = 'status'     and p_dir = 'asc'  then f.status     end asc  nulls last,
    case when p_sort = 'status'     and p_dir = 'desc' then f.status     end desc nulls last,
    case when p_sort = 'created_at' and p_dir = 'asc'  then f.created_at end asc  nulls last,
    case when p_sort = 'created_at' and p_dir = 'desc' then f.created_at end desc nulls last,
    case when p_sort = 'updated_at' and p_dir = 'asc'  then f.updated_at end asc  nulls last,
    f.updated_at desc
  limit greatest(1, least(p_limit, 100))
  offset greatest(0, p_offset);
end;
$$;
