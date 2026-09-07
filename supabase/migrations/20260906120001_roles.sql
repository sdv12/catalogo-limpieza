-- ============================================================
-- Roles por catálogo: admin · empleado · viewer
--   admin    → todo dentro del catálogo (incl. precios, niveles, import)
--   empleado → productos, variantes, stock, categorías, clientes, proveedores;
--              ve los precios pero no los modifica ni hace aumentos en lote
--   viewer   → solo lectura
--   is_superadmin (global) → todo, en todos los catálogos
-- ============================================================

-- ------------------------------------------------------------
-- catalog_members.role
-- ------------------------------------------------------------
alter table public.catalog_members drop constraint if exists catalog_members_role_check;

set session_replication_role = replica;
update public.catalog_members set role = 'admin' where role = 'editor';
set session_replication_role = default;

alter table public.catalog_members
  alter column role set default 'empleado',
  add constraint catalog_members_role_check check (role in ('admin', 'empleado', 'viewer'));

comment on table public.catalog_members is
  'Rol del usuario en el catálogo: admin (todo), empleado (edita catálogo/stock/clientes, no precios), viewer (solo lectura).';

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------
-- Puede editar contenido del catálogo (productos, stock, categorías, clientes…)
create or replace function public.can_edit_catalog(cat uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_superadmin()
      or exists (
        select 1 from public.catalog_members m
        where m.catalog_id = cat and m.user_id = auth.uid()
          and m.role in ('admin', 'empleado')
      );
$$;

-- Puede administrar el catálogo (precios, niveles, importación, config)
create or replace function public.is_catalog_admin(cat uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_superadmin()
      or exists (
        select 1 from public.catalog_members m
        where m.catalog_id = cat and m.user_id = auth.uid() and m.role = 'admin'
      );
$$;

-- Puede modificar precios (alias semántico de is_catalog_admin)
create or replace function public.can_manage_prices(cat uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_catalog_admin(cat);
$$;

grant execute on function public.is_catalog_admin(uuid) to authenticated;
grant execute on function public.can_manage_prices(uuid) to authenticated;

-- ------------------------------------------------------------
-- RLS: precios — el empleado puede fijar el precio al crear un producto,
-- pero solo un admin puede modificarlos o borrarlos después.
-- ------------------------------------------------------------
drop policy if exists "variant_prices: editor edita" on public.variant_prices;
drop policy if exists "variant_prices: editor borra" on public.variant_prices;

create policy "variant_prices: admin edita" on public.variant_prices
  for update to authenticated
  using (public.can_manage_prices(catalog_id))
  with check (public.can_manage_prices(catalog_id));

create policy "variant_prices: admin borra" on public.variant_prices
  for delete to authenticated
  using (public.can_manage_prices(catalog_id));

-- ------------------------------------------------------------
-- RLS: niveles de precio — solo admin
-- ------------------------------------------------------------
drop policy if exists "price_tiers: editor inserta" on public.price_tiers;
drop policy if exists "price_tiers: editor edita" on public.price_tiers;
drop policy if exists "price_tiers: editor borra" on public.price_tiers;

create policy "price_tiers: admin inserta" on public.price_tiers
  for insert to authenticated with check (public.is_catalog_admin(catalog_id));
create policy "price_tiers: admin edita" on public.price_tiers
  for update to authenticated
  using (public.is_catalog_admin(catalog_id)) with check (public.is_catalog_admin(catalog_id));
create policy "price_tiers: admin borra" on public.price_tiers
  for delete to authenticated using (public.is_catalog_admin(catalog_id));

-- ------------------------------------------------------------
-- RLS: importación en lote — solo admin
-- ------------------------------------------------------------
drop policy if exists "import_batches: editor inserta" on public.import_batches;
drop policy if exists "import_batches: editor edita" on public.import_batches;
drop policy if exists "import_batches: editor borra" on public.import_batches;

create policy "import_batches: admin inserta" on public.import_batches
  for insert to authenticated with check (public.is_catalog_admin(catalog_id));
create policy "import_batches: admin edita" on public.import_batches
  for update to authenticated
  using (public.is_catalog_admin(catalog_id)) with check (public.is_catalog_admin(catalog_id));
create policy "import_batches: admin borra" on public.import_batches
  for delete to authenticated using (public.is_catalog_admin(catalog_id));

-- ------------------------------------------------------------
-- Funciones: ajustar guardas de permisos
-- ------------------------------------------------------------
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
  if not public.can_manage_prices(p_catalog_id) then
    raise exception 'Solo un administrador puede modificar precios' using errcode = '42501';
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

-- Nota: run_import queda protegido porque su INSERT en import_batches ahora
-- exige is_catalog_admin (policy de arriba). El empleado tampoco ve el link
-- de "Carga masiva" en la app.
