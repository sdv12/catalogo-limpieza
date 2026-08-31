-- ============================================================
-- Etapa 1 · 0004 — Auditoría automática
-- Trigger genérico que:
--  1. rechaza cambios sin usuario autenticado (auth.uid() null),
--     salvo operaciones de sistema marcadas con app.allow_system_write,
--  2. calcula el diff de columnas (valor anterior → nuevo),
--  3. inserta en audit_log con el actor, timestamp y contexto.
-- Contexto opcional por transacción (lo fija la Server Action):
--  · app.audit_action  → fuerza el tipo de acción
--  · app.batch_id       → asocia el cambio a un import_batches
--  · app.stock_reason   → motivo del ajuste de stock
-- ============================================================

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
      return null;  -- seed / tarea de sistema: sin auditoría
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

  -- catálogo
  if v_entity = 'catalog' then
    v_catalog := coalesce((v_new->>'id')::uuid, (v_old->>'id')::uuid);
  else
    v_catalog := coalesce((v_new->>'catalog_id')::uuid, (v_old->>'catalog_id')::uuid);
  end if;

  -- entidad
  if v_entity = 'member' then
    v_entity_id := coalesce((v_new->>'user_id')::uuid, (v_old->>'user_id')::uuid);
  else
    v_entity_id := coalesce((v_new->>'id')::uuid, (v_old->>'id')::uuid);
  end if;

  -- producto asociado (para "historial por producto")
  if v_entity = 'product' then
    v_product := v_entity_id;
  elsif v_entity in ('variant', 'image') then
    v_product := coalesce((v_new->>'product_id')::uuid, (v_old->>'product_id')::uuid);
  elsif v_entity = 'price' then
    select pv.product_id into v_product
      from public.product_variants pv
      where pv.id = coalesce((v_new->>'variant_id')::uuid, (v_old->>'variant_id')::uuid);
  end if;

  -- diff
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

  -- tipo de acción
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

  -- update sin cambios y sin override → no registrar
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

-- ------------------------------------------------------------
-- Triggers
-- ------------------------------------------------------------
create trigger audit_catalogs after insert or update or delete on public.catalogs
  for each row execute function public.fn_audit('catalog');
create trigger audit_members after insert or update or delete on public.catalog_members
  for each row execute function public.fn_audit('member');
create trigger audit_categories after insert or update or delete on public.categories
  for each row execute function public.fn_audit('category');
create trigger audit_products after insert or update or delete on public.products
  for each row execute function public.fn_audit('product');
create trigger audit_variants after insert or update or delete on public.product_variants
  for each row execute function public.fn_audit('variant');
create trigger audit_prices after insert or update or delete on public.variant_prices
  for each row execute function public.fn_audit('price');
create trigger audit_images after insert or update or delete on public.product_images
  for each row execute function public.fn_audit('image');
