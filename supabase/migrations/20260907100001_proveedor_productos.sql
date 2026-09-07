-- ============================================================
-- Proveedores ↔ productos: la ficha del proveedor pasa a ser una
-- vista de trabajo de sus productos, con automatización de costos.
--
--  · audita product_suppliers (entity_type 'product_supplier')
--  · supplier_products         listado de productos del proveedor
--  · ajustar_costo_proveedor   sube/baja/fija product_suppliers.cost
--  · propagar_costo_proveedor  product_suppliers.cost → product_variants.cost
--  · vincular_productos_proveedor  enlaza varios productos de una
-- ============================================================

-- ------------------------------------------------------------
-- Auditoría de product_suppliers
-- ------------------------------------------------------------
alter table public.audit_log drop constraint audit_log_entity_type_check;
alter table public.audit_log add constraint audit_log_entity_type_check
  check (entity_type in ('product', 'variant', 'price', 'stock', 'category', 'image',
                         'catalog', 'member', 'customer', 'supplier', 'product_supplier'));

create or replace function public.fn_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor    uuid := auth.uid();
  v_email    text;
  v_entity   text := tg_argv[0];
  v_op       text := tg_op;
  v_new      jsonb;
  v_old      jsonb;
  v_catalog  uuid;
  v_entity_id uuid;
  v_product  uuid;
  v_changes  jsonb := '[]'::jsonb;
  v_key      text;
  v_action   text;
  v_override text := nullif(current_setting('app.audit_action', true), '');
  v_batch    text := nullif(current_setting('app.batch_id', true), '');
  v_reason   text := nullif(current_setting('app.stock_reason', true), '');
  v_ignore   text[] := array[
    'id', 'catalog_id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'user_id'
  ];
begin
  if v_actor is null then
    if coalesce(current_setting('app.allow_system_write', true), 'off') = 'on' then
      return null;
    end if;
    raise exception 'No se permiten cambios anónimos sobre el catálogo (%.%)',
      tg_table_schema, tg_table_name
      using errcode = '42501';
  end if;

  select p.email into v_email from public.profiles p where p.id = v_actor;

  if v_op = 'DELETE' then
    v_old := to_jsonb(old); v_new := '{}'::jsonb;
  elsif v_op = 'INSERT' then
    v_old := '{}'::jsonb; v_new := to_jsonb(new);
  else
    v_old := to_jsonb(old); v_new := to_jsonb(new);
  end if;

  if v_entity = 'catalog' then
    v_catalog := coalesce((v_new->>'id')::uuid, (v_old->>'id')::uuid);
  else
    v_catalog := coalesce((v_new->>'catalog_id')::uuid, (v_old->>'catalog_id')::uuid);
  end if;

  if v_entity = 'member' then
    v_entity_id := coalesce((v_new->>'user_id')::uuid, (v_old->>'user_id')::uuid);
  elsif v_entity = 'product_supplier' then
    v_entity_id := coalesce((v_new->>'supplier_id')::uuid, (v_old->>'supplier_id')::uuid);
  else
    v_entity_id := coalesce((v_new->>'id')::uuid, (v_old->>'id')::uuid);
  end if;

  if v_entity = 'product' then
    v_product := v_entity_id;
  elsif v_entity in ('variant', 'image', 'product_supplier') then
    v_product := coalesce((v_new->>'product_id')::uuid, (v_old->>'product_id')::uuid);
  elsif v_entity = 'price' then
    select pv.product_id into v_product
      from public.product_variants pv
      where pv.id = coalesce((v_new->>'variant_id')::uuid, (v_old->>'variant_id')::uuid);
  end if;

  for v_key in
    select k from (
      select jsonb_object_keys(v_new) as k
      union
      select jsonb_object_keys(v_old) as k
    ) s
    where k <> all (v_ignore)
  loop
    if (v_new->v_key) is distinct from (v_old->v_key) then
      v_changes := v_changes || jsonb_build_object(
        'field', v_key,
        'old', v_old->v_key,
        'new', v_new->v_key
      );
    end if;
  end loop;

  if v_override is not null then
    v_action := v_override;
  elsif v_op = 'INSERT' then
    v_action := 'create';
  elsif v_op = 'DELETE' then
    v_action := 'delete';
  elsif v_entity in ('product', 'variant')
        and (v_old->>'is_deleted') = 'false' and (v_new->>'is_deleted') = 'true' then
    v_action := 'delete';
  elsif v_entity in ('product', 'variant')
        and (v_old->>'is_deleted') = 'true' and (v_new->>'is_deleted') = 'false' then
    v_action := 'restore';
  else
    v_action := 'update';
  end if;

  if v_op = 'UPDATE' and v_changes = '[]'::jsonb and v_override is null then
    return null;
  end if;

  insert into public.audit_log (
    catalog_id, entity_type, entity_id, product_id, action,
    changes, summary, batch_id, actor_id, actor_email
  ) values (
    v_catalog, v_entity, v_entity_id, v_product, v_action,
    v_changes,
    case when v_reason is not null then 'Motivo: ' || v_reason else null end,
    v_batch::uuid, v_actor, v_email
  );

  return null;
end;
$$;

create trigger audit_product_suppliers
  after insert or update or delete on public.product_suppliers
  for each row execute function public.fn_audit('product_supplier');

-- ------------------------------------------------------------
-- supplier_products — productos de un proveedor con costo, precio y stock
-- ------------------------------------------------------------
create function public.supplier_products(p_catalog_id uuid, p_supplier_id uuid)
returns table (
  product_id       uuid,
  name             text,
  brand            text,
  base_sku         text,
  status           text,
  is_deleted       boolean,
  supplier_sku     text,
  cost             numeric,
  is_primary       boolean,
  min_price        numeric,
  min_variant_cost numeric,
  variant_count    bigint
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
  select
    p.id, p.name, p.brand, p.base_sku, p.status, p.is_deleted,
    ps.supplier_sku, ps.cost, ps.is_primary,
    (select min(vp.price) from public.variant_prices vp
       join public.product_variants v on v.id = vp.variant_id and v.is_deleted = false
       where v.product_id = p.id),
    (select min(v.cost) from public.product_variants v
       where v.product_id = p.id and v.is_deleted = false and v.cost is not null),
    (select count(*) from public.product_variants v
       where v.product_id = p.id and v.is_deleted = false)
  from public.product_suppliers ps
  join public.products p on p.id = ps.product_id
  where ps.catalog_id = p_catalog_id and ps.supplier_id = p_supplier_id
  order by p.is_deleted asc, p.name asc;
end;
$$;

grant execute on function public.supplier_products(uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- ajustar_costo_proveedor — sube / baja / fija product_suppliers.cost
-- ------------------------------------------------------------
create function public.ajustar_costo_proveedor(
  p_catalog_id  uuid,
  p_supplier_id uuid,
  p_mode        text default 'percent',
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
  v_total    integer := 0;
  v_con_costo integer := 0;
begin
  if not public.can_manage_prices(p_catalog_id) then
    raise exception 'Solo un administrador puede modificar costos' using errcode = '42501';
  end if;
  if p_mode not in ('percent', 'set') then
    raise exception 'Modo inválido: %', p_mode;
  end if;

  select count(*), count(*) filter (where cost is not null)
    into v_total, v_con_costo
    from public.product_suppliers
    where catalog_id = p_catalog_id and supplier_id = p_supplier_id;

  if not p_dry_run then
    if p_mode = 'percent' and p_value = 0 then
      raise exception 'El valor no puede ser cero.';
    end if;
    perform set_config('app.audit_action', 'price_adjust', true);
    update public.product_suppliers
      set cost = greatest(0, case
            when p_mode = 'percent' then
              case when p_round
                then round(cost * (1 + p_value / 100.0), 2)
                else cost * (1 + p_value / 100.0) end
            when p_mode = 'set' then p_value
          end)
      where catalog_id = p_catalog_id
        and supplier_id = p_supplier_id
        and (p_mode = 'set' or cost is not null);
  end if;

  return jsonb_build_object(
    'productos', coalesce(v_total, 0),
    'con_costo', coalesce(v_con_costo, 0)
  );
end;
$$;

grant execute on function public.ajustar_costo_proveedor(
  uuid, uuid, text, numeric, boolean, boolean) to authenticated;

-- ------------------------------------------------------------
-- propagar_costo_proveedor — copia el costo del proveedor a las
-- presentaciones de sus productos (base para repreciar por margen)
-- ------------------------------------------------------------
create function public.propagar_costo_proveedor(
  p_catalog_id     uuid,
  p_supplier_id    uuid,
  p_solo_sin_costo boolean default false,
  p_dry_run        boolean default false
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_pres integer := 0;
  v_prod integer := 0;
begin
  if not public.can_manage_prices(p_catalog_id) then
    raise exception 'Solo un administrador puede modificar costos' using errcode = '42501';
  end if;

  create temporary table _prop on commit drop as
  select pv.id as variant_id, pv.product_id, ps.cost
  from public.product_suppliers ps
  join public.product_variants pv
    on pv.product_id = ps.product_id and pv.is_deleted = false
  where ps.catalog_id = p_catalog_id
    and ps.supplier_id = p_supplier_id
    and ps.cost is not null
    and (not p_solo_sin_costo or pv.cost is null)
    and pv.cost is distinct from ps.cost;

  select count(*), count(distinct product_id) into v_pres, v_prod from _prop;

  if not p_dry_run and v_pres > 0 then
    perform set_config('app.audit_action', 'price_adjust', true);
    update public.product_variants pv
      set cost = o.cost, updated_by = auth.uid()
      from _prop o
      where pv.id = o.variant_id;
  end if;

  return jsonb_build_object(
    'presentaciones', coalesce(v_pres, 0),
    'productos', coalesce(v_prod, 0)
  );
end;
$$;

grant execute on function public.propagar_costo_proveedor(
  uuid, uuid, boolean, boolean) to authenticated;

-- ------------------------------------------------------------
-- vincular_productos_proveedor — enlaza varios productos de una
-- ------------------------------------------------------------
create function public.vincular_productos_proveedor(
  p_catalog_id   uuid,
  p_supplier_id  uuid,
  p_product_ids  uuid[],
  p_set_primary  boolean default false
)
returns integer
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_n integer := 0;
begin
  if not public.can_edit_catalog(p_catalog_id) then
    raise exception 'Sin permiso de edición' using errcode = '42501';
  end if;

  if p_set_primary then
    update public.product_suppliers
      set is_primary = false
      where catalog_id = p_catalog_id and product_id = any (p_product_ids);
  end if;

  insert into public.product_suppliers (product_id, supplier_id, catalog_id, is_primary)
  select p.id, p_supplier_id, p_catalog_id, p_set_primary
  from public.products p
  where p.id = any (p_product_ids)
    and p.catalog_id = p_catalog_id
    and p.is_deleted = false
  on conflict (product_id, supplier_id) do update
    set is_primary = case when p_set_primary then true
                          else public.product_suppliers.is_primary end;

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

grant execute on function public.vincular_productos_proveedor(
  uuid, uuid, uuid[], boolean) to authenticated;
