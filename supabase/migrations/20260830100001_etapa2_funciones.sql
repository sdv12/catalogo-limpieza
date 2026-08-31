-- ============================================================
-- Etapa 2 · funciones de apoyo
--  · duplicate_product   clona producto + variantes + precios
--  · catalog_stats       métricas del dashboard
--  · search_products     listado con búsqueda / filtros / orden / paginación
-- ============================================================

-- ------------------------------------------------------------
-- duplicate_product — deja el nuevo producto inactivo, stock 0,
-- SKUs con sufijo para no colisionar. Auditado como 'duplicate'.
-- ------------------------------------------------------------
create or replace function public.duplicate_product(p_product_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_src      public.products;
  v_new_id   uuid;
  v_suffix   text := '-' || substr(md5(random()::text), 1, 4);
  v_variant  public.product_variants;
  v_new_vid  uuid;
begin
  select * into v_src from public.products
    where id = p_product_id and is_deleted = false;
  if not found then
    raise exception 'Producto no encontrado';
  end if;
  if not public.can_edit_catalog(v_src.catalog_id) then
    raise exception 'Sin permiso de edición en este catálogo' using errcode = '42501';
  end if;

  perform set_config('app.audit_action', 'duplicate', true);

  insert into public.products (
    catalog_id, name, description, brand, base_sku,
    primary_category_id, status, attributes, created_by, updated_by
  ) values (
    v_src.catalog_id, v_src.name || ' (copia)', v_src.description, v_src.brand,
    case when v_src.base_sku is null then null else v_src.base_sku || v_suffix end,
    v_src.primary_category_id, 'inactive', v_src.attributes, auth.uid(), auth.uid()
  ) returning id into v_new_id;

  insert into public.product_categories (product_id, category_id, catalog_id, is_primary)
  select v_new_id, category_id, catalog_id, false
    from public.product_categories
    where product_id = p_product_id and is_primary = false;

  for v_variant in
    select * from public.product_variants
    where product_id = p_product_id and is_deleted = false
    order by position
  loop
    insert into public.product_variants (
      catalog_id, product_id, name, sku, size_value, size_unit, barcode,
      stock, min_stock, is_active, position, attributes, created_by, updated_by
    ) values (
      v_variant.catalog_id, v_new_id, v_variant.name, v_variant.sku || v_suffix,
      v_variant.size_value, v_variant.size_unit, v_variant.barcode,
      0, v_variant.min_stock, v_variant.is_active, v_variant.position,
      v_variant.attributes, auth.uid(), auth.uid()
    ) returning id into v_new_vid;

    insert into public.variant_prices (
      catalog_id, variant_id, price_tier_id, price, currency, updated_by
    )
    select catalog_id, v_new_vid, price_tier_id, price, currency, auth.uid()
      from public.variant_prices where variant_id = v_variant.id;
  end loop;

  return v_new_id;
end;
$$;

grant execute on function public.duplicate_product(uuid) to authenticated;

-- ------------------------------------------------------------
-- catalog_stats — resumen para el dashboard
-- ------------------------------------------------------------
create or replace function public.catalog_stats(p_catalog_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select case when public.is_catalog_member(p_catalog_id) then jsonb_build_object(
    'productos_total',
      (select count(*) from public.products
        where catalog_id = p_catalog_id and is_deleted = false),
    'productos_activos',
      (select count(*) from public.products
        where catalog_id = p_catalog_id and is_deleted = false and status = 'active'),
    'productos_inactivos',
      (select count(*) from public.products
        where catalog_id = p_catalog_id and is_deleted = false and status = 'inactive'),
    'variantes_total',
      (select count(*) from public.product_variants
        where catalog_id = p_catalog_id and is_deleted = false),
    'stock_bajo',
      (select count(distinct pv.product_id)
        from public.product_variants pv
        join public.products p on p.id = pv.product_id and p.is_deleted = false
        where pv.catalog_id = p_catalog_id and pv.is_deleted = false
          and pv.stock < pv.min_stock),
    'categorias',
      (select count(*) from public.categories where catalog_id = p_catalog_id)
  ) else '{}'::jsonb end;
$$;

grant execute on function public.catalog_stats(uuid) to authenticated;

-- ------------------------------------------------------------
-- search_products — listado del panel
--   p_stock: 'low' | 'ok' | null · p_status: 'active' | 'inactive' | null
--   p_sort:  name | status | created_at | updated_at
-- Devuelve total_count (window) para la paginación.
-- ------------------------------------------------------------
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
      (select bool_or(v.stock < v.min_stock) from public.product_variants v
         where v.product_id = p.id and v.is_deleted = false) as low_stock,
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
    select * from base
    where p_stock is null
       or (p_stock = 'low' and low_stock)
       or (p_stock = 'ok'  and not coalesce(low_stock, false))
  )
  select
    f.id, f.name, f.brand, f.base_sku, f.status, f.is_deleted, f.updated_at,
    f.category_name, f.variant_count, f.total_stock, coalesce(f.low_stock, false),
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

grant execute on function public.search_products(uuid, text, uuid, text, text, boolean, text, text, integer, integer) to authenticated;
