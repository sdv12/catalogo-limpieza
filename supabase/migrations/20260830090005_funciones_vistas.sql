-- ============================================================
-- Etapa 1 · 0005 — Funciones y vistas
--  · category_path            ruta legible de una categoría
--  · adjust_stock             ajuste de stock con motivo (auditado)
--  · apply_bulk_price_update  aumento/ajuste de precios en lote (auditado)
--  · catalog_view             vista denormalizada del catálogo
--  · search_catalog           RPC de búsqueda (pensada para chatbot)
-- ============================================================

-- ------------------------------------------------------------
-- Ruta de una categoría: "Limpieza de baño › Desinfectantes"
-- ------------------------------------------------------------
create or replace function public.category_path(p_category_id uuid)
returns text
language sql
stable
security invoker
set search_path = public
as $$
  with recursive sube as (
    select id, name, parent_id, 1 as nivel
      from public.categories where id = p_category_id
    union all
    select c.id, c.name, c.parent_id, s.nivel + 1
      from public.categories c
      join sube s on c.id = s.parent_id
  )
  select string_agg(name, ' › ' order by nivel desc) from sube;
$$;

-- ------------------------------------------------------------
-- Ajuste de stock con motivo. Registra el movimiento en
-- stock_movements y deja el ajuste en audit_log (action = stock_adjust).
-- ------------------------------------------------------------
create or replace function public.adjust_stock(
  p_variant_id uuid,
  p_delta      numeric,
  p_reason     text,
  p_note       text default null
)
returns public.product_variants
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_variant public.product_variants;
  v_prev    numeric;
begin
  if auth.uid() is null then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select * into v_variant from public.product_variants
    where id = p_variant_id for update;
  if not found then
    raise exception 'La variante no existe';
  end if;
  if not public.can_edit_catalog(v_variant.catalog_id) then
    raise exception 'Sin permiso de edición en este catálogo' using errcode = '42501';
  end if;

  v_prev := v_variant.stock;

  perform set_config('app.audit_action', 'stock_adjust', true);
  perform set_config('app.stock_reason', coalesce(p_reason, ''), true);

  update public.product_variants
    set stock = v_prev + p_delta, updated_by = auth.uid()
    where id = p_variant_id
    returning * into v_variant;

  insert into public.stock_movements (
    catalog_id, variant_id, delta, reason, note, previous_stock, new_stock, created_by
  ) values (
    v_variant.catalog_id, p_variant_id, p_delta, p_reason, p_note,
    v_prev, v_variant.stock, auth.uid()
  );

  return v_variant;
end;
$$;

-- ------------------------------------------------------------
-- Actualización de precios en lote.
--   p_mode: 'percent' (+/- %), 'amount' (+/- monto), 'set' (fijar)
-- Devuelve la cantidad de precios modificados.
-- ------------------------------------------------------------
create or replace function public.apply_bulk_price_update(
  p_catalog_id  uuid,
  p_category_id uuid   default null,
  p_tier_ids    uuid[] default null,
  p_mode        text   default 'percent',
  p_value       numeric default 0,
  p_round       boolean default true
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.can_edit_catalog(p_catalog_id) then
    raise exception 'Sin permiso de edición en este catálogo' using errcode = '42501';
  end if;
  if p_mode not in ('percent', 'amount', 'set') then
    raise exception 'Modo inválido: %', p_mode;
  end if;

  perform set_config('app.audit_action', 'bulk_price_update', true);

  with objetivo as (
    select vp.id,
      case p_mode
        when 'percent' then vp.price * (1 + p_value / 100.0)
        when 'amount'  then vp.price + p_value
        when 'set'     then p_value
      end as nuevo
    from public.variant_prices vp
    join public.product_variants pv on pv.id = vp.variant_id and pv.is_deleted = false
    join public.products p on p.id = pv.product_id and p.is_deleted = false
    where vp.catalog_id = p_catalog_id
      and (p_tier_ids is null or vp.price_tier_id = any (p_tier_ids))
      and (
        p_category_id is null
        or p.primary_category_id = p_category_id
        or exists (
          select 1 from public.product_categories pc
          where pc.product_id = p.id and pc.category_id = p_category_id
        )
      )
  )
  update public.variant_prices vp
    set price = greatest(0, case when p_round then round(o.nuevo, 2) else o.nuevo end),
        updated_by = auth.uid()
    from objetivo o
    where vp.id = o.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ------------------------------------------------------------
-- Vista denormalizada del catálogo (RLS del usuario aplica).
-- ------------------------------------------------------------
create or replace view public.catalog_view
with (security_invoker = true) as
select
  p.id                as product_id,
  p.catalog_id,
  c.slug              as catalog_slug,
  p.name,
  p.description,
  p.brand,
  p.base_sku,
  p.status,
  p.attributes        as product_attributes,
  p.primary_category_id,
  public.category_path(p.primary_category_id) as category_path,
  pv.id               as variant_id,
  pv.name             as variant_name,
  pv.sku,
  pv.size_value,
  pv.size_unit,
  pv.barcode,
  pv.stock,
  pv.min_stock,
  (pv.stock < pv.min_stock) as stock_bajo,
  coalesce(
    jsonb_object_agg(pt.code, vp.price) filter (where pt.code is not null),
    '{}'::jsonb
  )                   as prices
from public.products p
join public.catalogs c on c.id = p.catalog_id
left join public.product_variants pv
  on pv.product_id = p.id and pv.is_deleted = false
left join public.variant_prices vp on vp.variant_id = pv.id
left join public.price_tiers pt on pt.id = vp.price_tier_id
where p.is_deleted = false
group by p.id, p.primary_category_id, c.slug, pv.id;

-- ------------------------------------------------------------
-- RPC de búsqueda — devuelve JSON listo para una integración externa.
-- ------------------------------------------------------------
create or replace function public.search_catalog(
  p_catalog_slug text,
  p_q            text default null,
  p_tier_code    text default null,
  p_limit        integer default 50
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
  from (
    select
      cv.product_id, cv.name, cv.brand, cv.base_sku, cv.category_path,
      cv.variant_id, cv.variant_name, cv.sku, cv.size_value, cv.size_unit,
      cv.stock,
      case when p_tier_code is null then cv.prices
           else jsonb_build_object(p_tier_code, cv.prices -> p_tier_code) end as prices
    from public.catalog_view cv
    where cv.catalog_slug = p_catalog_slug
      and cv.status = 'active'
      and (
        p_q is null
        or cv.name ilike '%' || p_q || '%'
        or cv.base_sku ilike '%' || p_q || '%'
        or cv.sku ilike '%' || p_q || '%'
      )
    order by cv.name
    limit greatest(1, least(p_limit, 200))
  ) t;
$$;

-- ------------------------------------------------------------
-- Permisos
-- ------------------------------------------------------------
grant select on public.catalog_view to authenticated;
revoke all on public.catalog_view from anon;

grant execute on function public.category_path(uuid) to authenticated;
grant execute on function public.adjust_stock(uuid, numeric, text, text) to authenticated;
grant execute on function public.apply_bulk_price_update(uuid, uuid, uuid[], text, numeric, boolean) to authenticated;
grant execute on function public.search_catalog(text, text, text, integer) to authenticated;

revoke execute on function public.adjust_stock(uuid, numeric, text, text) from anon;
revoke execute on function public.apply_bulk_price_update(uuid, uuid, uuid[], text, numeric, boolean) from anon;
