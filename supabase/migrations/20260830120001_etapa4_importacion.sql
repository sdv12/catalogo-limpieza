-- ============================================================
-- Etapa 4 · carga masiva + ajustes en lote
--  · run_import              valida (dry_run) o ejecuta una importación
--  · apply_bulk_price_update se agrega p_dry_run para previsualizar
-- ============================================================

-- ------------------------------------------------------------
-- run_import
--   p_rows: array de filas normalizadas (una por presentación):
--     { _row, name, brand, base_sku, description, category, status,
--       variant_name, sku, size_value, size_unit, barcode,
--       stock, min_stock, prices: { <code>: number } }
--   p_dry_run = true  → solo valida, no escribe (para la vista previa)
--   Devuelve: { summary:{total, ok, error}, rows:[{_row, ok, errors[], name, sku}],
--               batch_id }
-- ------------------------------------------------------------
create or replace function public.run_import(
  p_catalog_id uuid,
  p_rows       jsonb,
  p_filename   text default null,
  p_dry_run    boolean default true
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_row        jsonb;
  v_idx        int;
  v_rownum     int;
  v_errors     jsonb;
  v_results    jsonb := '[]'::jsonb;
  v_ok_rows    int := 0;
  v_err_rows   int := 0;
  v_total      int := jsonb_array_length(coalesce(p_rows, '[]'::jsonb));
  v_cat_id     uuid;
  v_sku        text;
  v_base_sku   text;
  v_price_code text;
  v_price_val  numeric;
  v_tiene_precio boolean;
  v_seen_skus  text[] := array[]::text[];
  v_valid_tiers text[];
  v_batch_id   uuid;
  -- para la ejecución
  v_key        text;
  v_first      jsonb;
  v_prod_id    uuid;
  v_var_id     uuid;
  v_group_rows int;
  v_group_nums int[];
begin
  if not public.can_edit_catalog(p_catalog_id) then
    raise exception 'Sin permiso de edición en este catálogo' using errcode = '42501';
  end if;

  select array_agg(code) into v_valid_tiers
    from public.price_tiers where catalog_id = p_catalog_id and is_active;

  -- ---------- validación fila por fila ----------
  for v_idx in 0 .. v_total - 1 loop
    v_row := p_rows -> v_idx;
    v_rownum := coalesce((v_row ->> '_row')::int, v_idx + 1);
    v_errors := '[]'::jsonb;

    v_base_sku := nullif(btrim(coalesce(v_row ->> 'base_sku', '')), '');
    v_sku := nullif(btrim(coalesce(v_row ->> 'sku', '')), '');

    if nullif(btrim(coalesce(v_row ->> 'name', '')), '') is null then
      v_errors := v_errors || to_jsonb(('Falta el nombre del producto')::text);
    end if;
    if v_base_sku is null then
      v_errors := v_errors || to_jsonb(('Falta el SKU base')::text);
    end if;
    if nullif(btrim(coalesce(v_row ->> 'variant_name', '')), '') is null then
      v_errors := v_errors || to_jsonb(('Falta el nombre de la presentación')::text);
    end if;
    if v_sku is null then
      v_errors := v_errors || to_jsonb(('Falta el SKU de la presentación')::text);
    end if;

    -- categoría
    v_cat_id := null;
    if nullif(btrim(coalesce(v_row ->> 'category', '')), '') is null then
      v_errors := v_errors || to_jsonb(('Falta la categoría')::text);
    else
      select id into v_cat_id from public.categories
        where catalog_id = p_catalog_id
          and (lower(name) = lower(btrim(v_row ->> 'category'))
               or slug = lower(btrim(v_row ->> 'category')))
        limit 1;
      if v_cat_id is null then
        v_errors := v_errors || to_jsonb(format('La categoría "%s" no existe', v_row ->> 'category'));
      end if;
    end if;

    -- estado
    if coalesce(v_row ->> 'status', 'active') not in ('active', 'inactive') then
      v_errors := v_errors || to_jsonb(('Estado inválido (usar active o inactive)')::text);
    end if;

    -- unidad
    if nullif(v_row ->> 'size_unit', '') is not null
       and (v_row ->> 'size_unit') not in ('ml', 'l', 'g', 'kg', 'u') then
      v_errors := v_errors || to_jsonb(('Unidad inválida (ml, l, g, kg o u)')::text);
    end if;

    -- números
    begin
      if nullif(v_row ->> 'stock', '') is not null and (v_row ->> 'stock')::numeric < 0 then
        v_errors := v_errors || to_jsonb(('Stock negativo')::text);
      end if;
    exception when others then v_errors := v_errors || to_jsonb(('Stock no numérico')::text);
    end;
    begin
      if nullif(v_row ->> 'min_stock', '') is not null and (v_row ->> 'min_stock')::numeric < 0 then
        v_errors := v_errors || to_jsonb(('Stock mínimo negativo')::text);
      end if;
    exception when others then v_errors := v_errors || to_jsonb(('Stock mínimo no numérico')::text);
    end;

    -- precios
    v_tiene_precio := false;
    if jsonb_typeof(v_row -> 'prices') = 'object' then
      for v_price_code, v_price_val in
        select k, null::numeric from jsonb_object_keys(v_row -> 'prices') k
      loop
        begin
          v_price_val := (v_row -> 'prices' ->> v_price_code)::numeric;
        exception when others then
          v_errors := v_errors || to_jsonb(format('Precio "%s" no numérico', v_price_code));
          continue;
        end;
        if v_valid_tiers is null or not (v_price_code = any(v_valid_tiers)) then
          v_errors := v_errors || to_jsonb(format('Nivel de precio "%s" no existe en el catálogo', v_price_code));
        elsif v_price_val is not null and v_price_val < 0 then
          v_errors := v_errors || to_jsonb(format('Precio "%s" negativo', v_price_code));
        elsif v_price_val is not null and v_price_val > 0 then
          v_tiene_precio := true;
        end if;
      end loop;
    end if;
    if not v_tiene_precio then
      v_errors := v_errors || to_jsonb(('La presentación necesita al menos un precio')::text);
    end if;

    -- SKU duplicado dentro del archivo
    if v_sku is not null then
      if v_sku = any(v_seen_skus) then
        v_errors := v_errors || to_jsonb(format('El SKU "%s" está repetido en el archivo', v_sku));
      else
        v_seen_skus := array_append(v_seen_skus, v_sku);
      end if;
      -- SKU ya existente en el catálogo
      if exists (select 1 from public.product_variants
                 where catalog_id = p_catalog_id and sku = v_sku) then
        v_errors := v_errors || to_jsonb(format('El SKU "%s" ya existe en el catálogo', v_sku));
      end if;
    end if;

    -- SKU base ya existente (import = alta de productos nuevos)
    if v_base_sku is not null
       and exists (select 1 from public.products
                   where catalog_id = p_catalog_id and base_sku = v_base_sku
                     and is_deleted = false) then
      v_errors := v_errors || to_jsonb(format('Ya existe un producto con el SKU base "%s"', v_base_sku));
    end if;

    if jsonb_array_length(v_errors) = 0 then
      v_ok_rows := v_ok_rows + 1;
    else
      v_err_rows := v_err_rows + 1;
    end if;

    v_results := v_results || jsonb_build_object(
      '_row', v_rownum,
      'ok', jsonb_array_length(v_errors) = 0,
      'errors', v_errors,
      'name', v_row ->> 'name',
      'sku', v_sku
    );
  end loop;

  -- ---------- vista previa: no escribir ----------
  if p_dry_run then
    return jsonb_build_object(
      'summary', jsonb_build_object('total', v_total, 'ok', v_ok_rows, 'error', v_err_rows),
      'rows', v_results,
      'batch_id', null
    );
  end if;

  -- ---------- ejecución ----------
  insert into public.import_batches (catalog_id, kind, filename, status, total_rows, ok_rows, error_rows, actor_id)
  values (p_catalog_id, 'product_import', p_filename, 'previewed', v_total, v_ok_rows, v_err_rows, auth.uid())
  returning id into v_batch_id;

  perform set_config('app.batch_id', v_batch_id::text, true);
  perform set_config('app.audit_action', 'bulk_import', true);

  -- reiniciar contadores para el resultado real de inserción
  v_ok_rows := 0;
  v_err_rows := 0;
  v_results := '[]'::jsonb;

  for v_key in
    select distinct lower(btrim(r ->> 'base_sku'))
    from jsonb_array_elements(p_rows) r
    where nullif(btrim(coalesce(r ->> 'base_sku', '')), '') is not null
  loop
    select r into v_first from jsonb_array_elements(p_rows) r
      where lower(btrim(r ->> 'base_sku')) = v_key limit 1;

    select array_agg(coalesce((r ->> '_row')::int, 0)), count(*)
      into v_group_nums, v_group_rows
      from jsonb_array_elements(p_rows) r
      where lower(btrim(r ->> 'base_sku')) = v_key;

    begin
      select id into v_cat_id from public.categories
        where catalog_id = p_catalog_id
          and (lower(name) = lower(btrim(v_first ->> 'category'))
               or slug = lower(btrim(v_first ->> 'category')))
        limit 1;
      if v_cat_id is null then
        raise exception 'La categoría "%" no existe', v_first ->> 'category';
      end if;
      if exists (select 1 from public.products
                 where catalog_id = p_catalog_id and base_sku = btrim(v_first ->> 'base_sku')
                   and is_deleted = false) then
        raise exception 'Ya existe un producto con el SKU base "%"', v_first ->> 'base_sku';
      end if;

      insert into public.products (
        catalog_id, name, description, brand, base_sku,
        primary_category_id, status, created_by, updated_by
      ) values (
        p_catalog_id,
        btrim(v_first ->> 'name'),
        nullif(btrim(coalesce(v_first ->> 'description', '')), ''),
        nullif(btrim(coalesce(v_first ->> 'brand', '')), ''),
        btrim(v_first ->> 'base_sku'),
        v_cat_id,
        coalesce(nullif(v_first ->> 'status', ''), 'active'),
        auth.uid(), auth.uid()
      ) returning id into v_prod_id;

      for v_row in
        select r from jsonb_array_elements(p_rows) r
        where lower(btrim(r ->> 'base_sku')) = v_key
        order by (r ->> '_row')::int
      loop
        insert into public.product_variants (
          catalog_id, product_id, name, sku, size_value, size_unit, barcode,
          stock, min_stock, created_by, updated_by
        ) values (
          p_catalog_id, v_prod_id,
          btrim(v_row ->> 'variant_name'),
          btrim(v_row ->> 'sku'),
          nullif(v_row ->> 'size_value', '')::numeric,
          nullif(v_row ->> 'size_unit', ''),
          nullif(btrim(coalesce(v_row ->> 'barcode', '')), ''),
          coalesce(nullif(v_row ->> 'stock', '')::numeric, 0),
          coalesce(nullif(v_row ->> 'min_stock', '')::numeric, 0),
          auth.uid(), auth.uid()
        ) returning id into v_var_id;

        insert into public.variant_prices (catalog_id, variant_id, price_tier_id, price, updated_by)
        select p_catalog_id, v_var_id, pt.id, (v_row -> 'prices' ->> pt.code)::numeric, auth.uid()
        from public.price_tiers pt
        where pt.catalog_id = p_catalog_id
          and (v_row -> 'prices' ->> pt.code) is not null
          and (v_row -> 'prices' ->> pt.code) ~ '^[0-9.]+$'
          and (v_row -> 'prices' ->> pt.code)::numeric > 0;
      end loop;

      v_ok_rows := v_ok_rows + v_group_rows;
      v_results := v_results || jsonb_build_object(
        'base_sku', v_first ->> 'base_sku', 'rows', to_jsonb(v_group_nums),
        'ok', true, 'errors', '[]'::jsonb);

    exception when others then
      v_err_rows := v_err_rows + v_group_rows;
      v_results := v_results || jsonb_build_object(
        'base_sku', v_first ->> 'base_sku', 'rows', to_jsonb(v_group_nums),
        'ok', false, 'errors', to_jsonb(array[SQLERRM]));
    end;
  end loop;

  update public.import_batches
    set status = case when v_err_rows = 0 then 'completed'
                      when v_ok_rows = 0 then 'failed'
                      else 'partial' end,
        ok_rows = v_ok_rows,
        error_rows = v_err_rows,
        report = v_results,
        completed_at = now()
    where id = v_batch_id;

  return jsonb_build_object(
    'summary', jsonb_build_object('total', v_total, 'ok', v_ok_rows, 'error', v_err_rows),
    'rows', v_results,
    'batch_id', v_batch_id
  );
end;
$$;

grant execute on function public.run_import(uuid, jsonb, text, boolean) to authenticated;

-- ------------------------------------------------------------
-- apply_bulk_price_update — se reemplaza para agregar p_dry_run
-- ------------------------------------------------------------
drop function if exists public.apply_bulk_price_update(uuid, uuid, uuid[], text, numeric, boolean);

create or replace function public.apply_bulk_price_update(
  p_catalog_id  uuid,
  p_category_id uuid    default null,
  p_tier_ids    uuid[]  default null,
  p_mode        text    default 'percent',
  p_value       numeric default 0,
  p_round       boolean default true,
  p_dry_run     boolean default false
)
returns integer
language plpgsql
volatile
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

  if p_dry_run then
    select count(*) into v_count
    from public.variant_prices vp
    join public.product_variants pv on pv.id = vp.variant_id and pv.is_deleted = false
    join public.products p on p.id = pv.product_id and p.is_deleted = false
    where vp.catalog_id = p_catalog_id
      and (p_tier_ids is null or vp.price_tier_id = any (p_tier_ids))
      and (
        p_category_id is null
        or p.primary_category_id = p_category_id
        or exists (select 1 from public.product_categories pc
                   where pc.product_id = p.id and pc.category_id = p_category_id)
      );
    return v_count;
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
        or exists (select 1 from public.product_categories pc
                   where pc.product_id = p.id and pc.category_id = p_category_id)
      )
  ),
  aplicado as (
    update public.variant_prices vp
      set price = greatest(0, case when p_round then round(o.nuevo, 2) else o.nuevo end),
          updated_by = auth.uid()
      from objetivo o
      where vp.id = o.id
      returning vp.id
  )
  select count(*) into v_count from aplicado;

  return v_count;
end;
$$;

grant execute on function public.apply_bulk_price_update(uuid, uuid, uuid[], text, numeric, boolean, boolean) to authenticated;
