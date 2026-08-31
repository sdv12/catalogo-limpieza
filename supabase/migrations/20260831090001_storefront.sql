-- ============================================================
-- Etapa 5 · API pública (storefront)
-- Funciones SECURITY DEFINER de solo lectura que exponen únicamente
-- productos activos y no eliminados, para que una landing / chatbot
-- externo consuma el catálogo sin tocar el RLS del panel.
-- Devuelven las imágenes como `storage_path` (el consumidor arma la
-- URL pública: {SUPABASE_URL}/storage/v1/object/public/product-images/<path>).
-- ============================================================

-- ------------------------------------------------------------
-- storefront_meta — datos del catálogo + árbol de categorías + niveles
-- ------------------------------------------------------------
create or replace function public.storefront_meta(p_catalog_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with c as (
    select id, slug, name from public.catalogs
    where slug = p_catalog_slug and is_active
  )
  select case when c.id is null then null else jsonb_build_object(
    'catalogo', jsonb_build_object('slug', c.slug, 'nombre', c.name),
    'niveles_precio', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'code', pt.code, 'nombre', pt.name, 'por_defecto', pt.is_default
      ) order by pt.sort_order), '[]'::jsonb)
      from public.price_tiers pt
      where pt.catalog_id = c.id and pt.is_active
    ),
    'categorias', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'slug', cat.slug, 'nombre', cat.name,
        'padre', (select p.slug from public.categories p where p.id = cat.parent_id),
        'productos', (
          select count(*) from public.products pr
          where pr.primary_category_id = cat.id
            and pr.is_deleted = false and pr.status = 'active'
        )
      ) order by cat.sort_order), '[]'::jsonb)
      from public.categories cat
      where cat.catalog_id = c.id and cat.is_active
    )
  ) end
  from c;
$$;

-- ------------------------------------------------------------
-- storefront_products — listado / búsqueda / detalle
--   p_sku no nulo → devuelve el único producto con ese sku_base
-- ------------------------------------------------------------
create or replace function public.storefront_products(
  p_catalog_slug text,
  p_q            text default null,
  p_category     text default null,   -- slug de categoría
  p_sku          text default null,   -- sku_base para el detalle
  p_limit        integer default 60,
  p_offset       integer default 0
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with c as (
    select id from public.catalogs where slug = p_catalog_slug and is_active
  ),
  base as (
    select p.*
    from public.products p, c
    where p.catalog_id = c.id
      and p.is_deleted = false
      and p.status = 'active'
      and (p_sku is null or p.base_sku = p_sku)
      and (p_category is null or exists (
        select 1 from public.categories cat
        where cat.id = p.primary_category_id and cat.slug = p_category))
      and (p_q is null
        or p.name ilike '%' || p_q || '%'
        or p.base_sku ilike '%' || p_q || '%'
        or exists (select 1 from public.product_variants v
                   where v.product_id = p.id and v.sku ilike '%' || p_q || '%'))
    order by p.name
    limit least(greatest(p_limit, 1), 200)
    offset greatest(p_offset, 0)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id,
    'sku_base', b.base_sku,
    'nombre', b.name,
    'descripcion', b.description,
    'marca', b.brand,
    'categoria', (select cat.name from public.categories cat where cat.id = b.primary_category_id),
    'categoria_slug', (select cat.slug from public.categories cat where cat.id = b.primary_category_id),
    'atributos', b.attributes,
    'actualizado', b.updated_at,
    'imagenes', (
      select coalesce(jsonb_agg(i.storage_path order by i.is_primary desc, i.position), '[]'::jsonb)
      from public.product_images i where i.product_id = b.id
    ),
    'presentaciones', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'sku', v.sku,
        'nombre', v.name,
        'tamano', v.size_value,
        'unidad', v.size_unit,
        'codigo_barras', v.barcode,
        'stock', v.stock,
        'disponible', v.stock > 0,
        'precios', (
          select coalesce(jsonb_object_agg(pt.code, jsonb_build_object(
            'nombre', pt.name, 'precio', vp.price, 'moneda', vp.currency
          )), '{}'::jsonb)
          from public.variant_prices vp
          join public.price_tiers pt on pt.id = vp.price_tier_id
          where vp.variant_id = v.id and pt.is_active
        )
      ) order by v.position), '[]'::jsonb)
      from public.product_variants v
      where v.product_id = b.id and v.is_deleted = false and v.is_active
    )
  )), '[]'::jsonb)
  from base b;
$$;

revoke all on function public.storefront_meta(text) from public;
revoke all on function public.storefront_products(text, text, text, text, integer, integer) from public;
grant execute on function public.storefront_meta(text) to anon, authenticated, service_role;
grant execute on function public.storefront_products(text, text, text, text, integer, integer) to anon, authenticated, service_role;
