-- ============================================================
-- catalog_stats: se agregan clientes, proveedores y valor de inventario
-- ============================================================
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
    'sin_stock',
      (select count(distinct pv.product_id)
        from public.product_variants pv
        join public.products p on p.id = pv.product_id and p.is_deleted = false
        where pv.catalog_id = p_catalog_id and pv.is_deleted = false and pv.stock <= 0),
    'categorias',
      (select count(*) from public.categories where catalog_id = p_catalog_id),
    'clientes',
      (select count(*) from public.customers
        where catalog_id = p_catalog_id and is_deleted = false),
    'proveedores',
      (select count(*) from public.suppliers
        where catalog_id = p_catalog_id and is_deleted = false),
    'inventario_costo',
      (select coalesce(sum(pv.stock * pv.cost), 0)
        from public.product_variants pv
        join public.products p on p.id = pv.product_id and p.is_deleted = false
        where pv.catalog_id = p_catalog_id and pv.is_deleted = false and pv.cost is not null),
    'unidades_stock',
      (select coalesce(sum(pv.stock), 0)
        from public.product_variants pv
        join public.products p on p.id = pv.product_id and p.is_deleted = false
        where pv.catalog_id = p_catalog_id and pv.is_deleted = false)
  ) else '{}'::jsonb end;
$$;

grant execute on function public.catalog_stats(uuid) to authenticated;
