-- ============================================================
-- Sucursales: cada catálogo es "ecommerce" (Aura, Aromas: tienen tienda
-- online) o "sucursal" (local físico, panel independiente con sus
-- propios productos, precios, clientes y stock). Solo el superadmin crea
-- catálogos (sin cambios en RLS de catalogs).
--
-- Las sucursales no tienen tienda: las funciones públicas storefront_*
-- solo responden para catálogos ecommerce (se redefinen igual que antes,
-- con esa condición extra), y no se pueden crear claves de canal.
-- ============================================================

alter table public.catalogs
  add column kind text not null default 'ecommerce'
  check (kind in ('ecommerce', 'sucursal'));

comment on column public.catalogs.kind is
  'ecommerce = tiene tienda online y API pública; sucursal = local físico sin tienda.';

-- ------------------------------------------------------------
-- API pública: solo catálogos ecommerce
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
    where slug = p_catalog_slug and is_active and kind = 'ecommerce'
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
    select id from public.catalogs where slug = p_catalog_slug and is_active and kind = 'ecommerce'
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

create or replace function public.storefront_promos(p_catalog_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with c as (
    select id from public.catalogs where slug = p_catalog_slug and is_active and kind = 'ecommerce'
  )
  select coalesce(jsonb_agg(x order by x_kind, x_pos), '[]'::jsonb)
  from (
    select
      pr.kind as x_kind,
      pr.position as x_pos,
      jsonb_build_object(
        'tipo', pr.kind,
        'orden', pr.position,
        'titulo', coalesce(pr.title, p.name),
        'subtitulo', pr.subtitle,
        'link', coalesce(pr.link, '/producto/' || coalesce(p.base_sku, p.id::text)),
        'descuento', case when pr.discount_type is not null
          then jsonb_build_object('tipo', pr.discount_type, 'valor', pr.discount_value)
          else null end,
        'producto', jsonb_build_object(
          'sku', p.base_sku,
          'nombre', p.name,
          'marca', p.brand,
          'imagen', (select i.storage_path from public.product_images i
                     where i.product_id = p.id
                     order by i.is_primary desc, i.position asc limit 1)
        )
      ) as x
    from public.promotions pr
    join c on c.id = pr.catalog_id
    join public.products p
      on p.id = pr.product_id and p.is_deleted = false and p.status = 'active'
    where pr.is_active
      and (pr.starts_at is null or now() >= pr.starts_at)
      and (pr.ends_at is null or now() <= pr.ends_at)
  ) s;
$$;

-- ------------------------------------------------------------
-- Claves de canal (tiendas / bot): solo en catálogos ecommerce
-- ------------------------------------------------------------
create or replace function public.protect_channel_key_kind()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.catalogs c where c.id = new.catalog_id and c.kind <> 'ecommerce') then
    raise exception 'Las sucursales no tienen tienda online: no llevan claves de canal';
  end if;
  return new;
end;
$$;

create trigger protect_channel_key_kind
  before insert or update of catalog_id on public.channel_keys
  for each row execute function public.protect_channel_key_kind();
