-- ============================================================
-- Reprecio contextual: el listado de productos filtra también por
-- marca y proveedor, y el ajuste de precios en lote opera sobre el
-- mismo conjunto de filtros (no solo por categoría).
--
--  · search_products      + p_brand, p_supplier_id ; q matchea marca y
--                           proveedor ; devuelve supplier_name y min_cost
--  · reprecio_por_filtro   reemplaza a apply_bulk_price_update: acepta
--                           todo el set de filtros + modo 'margin'
-- ============================================================

-- ------------------------------------------------------------
-- search_products
-- ------------------------------------------------------------
drop function if exists public.search_products(
  uuid, text, uuid, text, text, boolean, text, text, integer, integer);

create function public.search_products(
  p_catalog_id      uuid,
  p_q               text default null,
  p_category_id     uuid default null,
  p_brand           text default null,
  p_supplier_id     uuid default null,
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
  supplier_name text,
  variant_count bigint,
  total_stock   numeric,
  low_stock     boolean,
  min_price     numeric,
  max_price     numeric,
  min_cost      numeric,
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
      (select s.name from public.product_suppliers ps
         join public.suppliers s on s.id = ps.supplier_id
         where ps.product_id = p.id
         order by ps.is_primary desc, s.name asc limit 1) as supplier_name,
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
      (select min(v.cost) from public.product_variants v
         where v.product_id = p.id and v.is_deleted = false and v.cost is not null) as min_cost,
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
      and (p_brand is null or p.brand = p_brand)
      and (
        p_supplier_id is null
        or exists (select 1 from public.product_suppliers ps
                   where ps.product_id = p.id and ps.supplier_id = p_supplier_id)
      )
      and (
        p_q is null
        or p.name ilike '%' || p_q || '%'
        or p.base_sku ilike '%' || p_q || '%'
        or p.brand ilike '%' || p_q || '%'
        or exists (select 1 from public.product_variants v
                   where v.product_id = p.id and v.sku ilike '%' || p_q || '%')
        or exists (select 1 from public.product_suppliers ps
                   join public.suppliers s on s.id = ps.supplier_id
                   where ps.product_id = p.id and s.name ilike '%' || p_q || '%')
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
    f.category_name, f.supplier_name, f.variant_count, f.total_stock, f.low_stock,
    f.min_price, f.max_price, f.min_cost, f.primary_image,
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

grant execute on function public.search_products(
  uuid, text, uuid, text, uuid, text, text, boolean, text, text, integer, integer)
  to authenticated;
revoke execute on function public.search_products(
  uuid, text, uuid, text, uuid, text, text, boolean, text, text, integer, integer)
  from anon;

-- ------------------------------------------------------------
-- reprecio_por_filtro  (reemplaza apply_bulk_price_update)
-- ------------------------------------------------------------
drop function if exists public.apply_bulk_price_update(
  uuid, uuid, uuid[], text, numeric, boolean, boolean);
drop function if exists public.apply_bulk_price_update(
  uuid, uuid, uuid[], text, numeric, boolean);

create function public.reprecio_por_filtro(
  p_catalog_id  uuid,
  p_q           text    default null,
  p_category_id uuid    default null,
  p_brand       text    default null,
  p_supplier_id uuid    default null,
  p_status      text    default null,
  p_stock       text    default null,
  p_tier_ids    uuid[]  default null,
  p_mode        text    default 'percent',
  p_value       numeric default 0,
  p_round       boolean default true,
  p_dry_run     boolean default false
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_productos integer := 0;
  v_precios   integer := 0;
  v_sin_costo integer := 0;
begin
  if not public.can_manage_prices(p_catalog_id) then
    raise exception 'Solo un administrador puede modificar precios' using errcode = '42501';
  end if;
  if p_mode not in ('percent', 'amount', 'set', 'margin') then
    raise exception 'Modo inválido: %', p_mode;
  end if;

  -- precios candidatos según el set de filtros del listado
  create temporary table _reprecio on commit drop as
  select vp.id as price_id, pv.product_id, pv.cost, vp.price as actual,
    case p_mode
      when 'percent' then vp.price * (1 + p_value / 100.0)
      when 'amount'  then vp.price + p_value
      when 'set'     then p_value
      when 'margin'  then pv.cost * (1 + p_value / 100.0)
    end as nuevo
  from public.variant_prices vp
  join public.product_variants pv on pv.id = vp.variant_id and pv.is_deleted = false
  join public.products p on p.id = pv.product_id and p.is_deleted = false
  where vp.catalog_id = p_catalog_id
    and (p_tier_ids is null or vp.price_tier_id = any (p_tier_ids))
    and (p_status is null or p.status = p_status)
    and (
      p_category_id is null
      or p.primary_category_id = p_category_id
      or exists (select 1 from public.product_categories pc
                 where pc.product_id = p.id and pc.category_id = p_category_id)
    )
    and (p_brand is null or p.brand = p_brand)
    and (
      p_supplier_id is null
      or exists (select 1 from public.product_suppliers ps
                 where ps.product_id = p.id and ps.supplier_id = p_supplier_id)
    )
    and (
      p_q is null
      or p.name ilike '%' || p_q || '%'
      or p.base_sku ilike '%' || p_q || '%'
      or p.brand ilike '%' || p_q || '%'
      or exists (select 1 from public.product_variants v
                 where v.product_id = p.id and v.sku ilike '%' || p_q || '%')
      or exists (select 1 from public.product_suppliers ps
                 join public.suppliers s on s.id = ps.supplier_id
                 where ps.product_id = p.id and s.name ilike '%' || p_q || '%')
    )
    and (
      p_stock is null or p_stock not in ('low', 'ok')
      or (p_stock = 'low') = coalesce(
           (select bool_or(v.stock < v.min_stock) from public.product_variants v
              where v.product_id = p.id and v.is_deleted = false), false)
    );

  -- 'margin' solo aplica a presentaciones con costo cargado
  select
    count(*) filter (where p_mode <> 'margin' or cost is not null),
    count(distinct product_id) filter (where p_mode <> 'margin' or cost is not null),
    count(*) filter (where p_mode = 'margin' and cost is null)
    into v_precios, v_productos, v_sin_costo
  from _reprecio;

  if not p_dry_run and v_precios > 0 then
    if p_mode <> 'set' and p_value = 0 then
      raise exception 'El valor no puede ser cero.';
    end if;
    perform set_config('app.audit_action', 'bulk_price_update', true);
    update public.variant_prices vp
      set price = greatest(0, case when p_round then round(o.nuevo, 2) else o.nuevo end),
          updated_by = auth.uid()
      from _reprecio o
      where vp.id = o.price_id
        and o.nuevo is not null
        and (p_mode <> 'margin' or o.cost is not null);
  end if;

  return jsonb_build_object(
    'productos', coalesce(v_productos, 0),
    'precios', coalesce(v_precios, 0),
    'sin_costo', coalesce(v_sin_costo, 0)
  );
end;
$$;

grant execute on function public.reprecio_por_filtro(
  uuid, text, uuid, text, uuid, text, text, uuid[], text, numeric, boolean, boolean)
  to authenticated;
revoke execute on function public.reprecio_por_filtro(
  uuid, text, uuid, text, uuid, text, text, uuid[], text, numeric, boolean, boolean)
  from anon;
