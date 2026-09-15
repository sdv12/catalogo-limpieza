-- ============================================================
-- Permisos granulares para el rol "empleado". El rol sigue existiendo
-- como base (admin / empleado / viewer), pero ahora el admin puede
-- prenderle a cada empleado permisos puntuales, además de la base:
--
--   Base de "empleado" (siempre, sin permiso):
--     productos/stock, clientes/proveedores, cargar cargo/pago en
--     cuenta corriente, Y AHORA TAMBIÉN editar el precio de un
--     producto ya cargado (antes exigía ser admin).
--
--   Permisos opcionales (uno o varios, por usuario):
--     precios_lote   — niveles de precio + reprecio/repreciar en lote
--     costos         — ver costo/proveedor en productos, costeo de proveedores
--     carga_masiva   — importación masiva
--     promos         — carrusel/destacados/ofertas
--     cuenta_corriente_admin — editar/borrar movimientos ya cargados
--     usuarios       — gestionar usuarios del catálogo (menos volverlos
--                       admin ni tocar administradores: eso sigue siendo
--                       exclusivo de quien ya es admin)
--
-- Admin y viewer ignoran `permissions` (admin ya tiene todo, viewer nada).
-- ============================================================

alter table public.catalog_members
  add column if not exists permissions text[] not null default '{}'::text[];

alter table public.catalog_members
  add constraint catalog_members_permissions_check
  check (permissions <@ array[
    'precios_lote', 'costos', 'carga_masiva', 'promos',
    'cuenta_corriente_admin', 'usuarios'
  ]::text[]);

comment on column public.catalog_members.permissions is
  'Permisos extra para role=empleado. admin/viewer la ignoran. Valores: precios_lote, costos, carga_masiva, promos, cuenta_corriente_admin, usuarios.';

-- ------------------------------------------------------------
-- tiene_permiso: un admin (o superadmin) siempre da true; un empleado
-- según su lista de permisos.
-- ------------------------------------------------------------
create or replace function public.tiene_permiso(cat uuid, perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_catalog_admin(cat)
      or exists (
        select 1 from public.catalog_members m
        where m.catalog_id = cat and m.user_id = auth.uid()
          and m.role = 'empleado' and perm = any (m.permissions)
      );
$$;

grant execute on function public.tiene_permiso(uuid, text) to authenticated;

-- can_manage_prices pasa a significar "niveles de precio + reprecio en
-- lote" (permiso precios_lote). Editar el precio de UN producto ya
-- cargado deja de depender de esto (ver variant_prices más abajo).
create or replace function public.can_manage_prices(cat uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.tiene_permiso(cat, 'precios_lote');
$$;

-- costeo de proveedores: permiso propio, ya no comparte llave con precios.
create or replace function public.can_manage_costs(cat uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.tiene_permiso(cat, 'costos');
$$;

grant execute on function public.can_manage_costs(uuid) to authenticated;

-- ------------------------------------------------------------
-- variant_prices: editar/borrar el precio de un producto ya cargado
-- pasa a ser base de "empleado" (can_edit_catalog), no admin-only.
-- price_tiers y reprecio_por_filtro NO cambian acá: siguen llamando a
-- can_manage_prices(), que ahora exige el permiso precios_lote.
-- ------------------------------------------------------------
drop policy if exists "variant_prices: admin edita" on public.variant_prices;
drop policy if exists "variant_prices: admin borra" on public.variant_prices;

create policy "variant_prices: editor edita" on public.variant_prices
  for update to authenticated
  using (public.can_edit_catalog(catalog_id))
  with check (public.can_edit_catalog(catalog_id));
create policy "variant_prices: editor borra" on public.variant_prices
  for delete to authenticated using (public.can_edit_catalog(catalog_id));

-- ------------------------------------------------------------
-- import_batches: permiso carga_masiva
-- ------------------------------------------------------------
drop policy if exists "import_batches: admin inserta" on public.import_batches;
drop policy if exists "import_batches: admin edita" on public.import_batches;
drop policy if exists "import_batches: admin borra" on public.import_batches;

create policy "import_batches: permiso inserta" on public.import_batches
  for insert to authenticated with check (public.tiene_permiso(catalog_id, 'carga_masiva'));
create policy "import_batches: permiso edita" on public.import_batches
  for update to authenticated
  using (public.tiene_permiso(catalog_id, 'carga_masiva'))
  with check (public.tiene_permiso(catalog_id, 'carga_masiva'));
create policy "import_batches: permiso borra" on public.import_batches
  for delete to authenticated using (public.tiene_permiso(catalog_id, 'carga_masiva'));

-- ------------------------------------------------------------
-- promotions: permiso promos
-- ------------------------------------------------------------
drop policy if exists "promotions: admin inserta" on public.promotions;
drop policy if exists "promotions: admin edita" on public.promotions;
drop policy if exists "promotions: admin borra" on public.promotions;

create policy "promotions: permiso inserta" on public.promotions
  for insert to authenticated with check (public.tiene_permiso(catalog_id, 'promos'));
create policy "promotions: permiso edita" on public.promotions
  for update to authenticated
  using (public.tiene_permiso(catalog_id, 'promos'))
  with check (public.tiene_permiso(catalog_id, 'promos'));
create policy "promotions: permiso borra" on public.promotions
  for delete to authenticated using (public.tiene_permiso(catalog_id, 'promos'));

-- ------------------------------------------------------------
-- customer_transactions: editar/borrar movimientos ya cargados,
-- permiso cuenta_corriente_admin. Cargar cargo/pago nuevo sigue base.
-- ------------------------------------------------------------
drop policy if exists "customer_transactions: admin edita" on public.customer_transactions;
drop policy if exists "customer_transactions: admin borra" on public.customer_transactions;

create policy "customer_transactions: permiso edita" on public.customer_transactions
  for update to authenticated
  using (public.tiene_permiso(catalog_id, 'cuenta_corriente_admin'))
  with check (public.tiene_permiso(catalog_id, 'cuenta_corriente_admin'));
create policy "customer_transactions: permiso borra" on public.customer_transactions
  for delete to authenticated using (public.tiene_permiso(catalog_id, 'cuenta_corriente_admin'));

-- ------------------------------------------------------------
-- catalog_members: permiso usuarios. Puede leer/agregar/editar/quitar
-- usuarios NO-admin; no puede tocar a un admin existente ni volver
-- admin a nadie (eso queda exclusivo de is_catalog_admin/superadmin,
-- cubierto por las policies ya existentes de la migración anterior).
-- ------------------------------------------------------------
create policy "members: permiso usuarios lee" on public.catalog_members
  for select to authenticated using (public.tiene_permiso(catalog_id, 'usuarios'));

create policy "members: permiso usuarios inserta" on public.catalog_members
  for insert to authenticated
  with check (public.tiene_permiso(catalog_id, 'usuarios') and role <> 'admin');
create policy "members: permiso usuarios edita" on public.catalog_members
  for update to authenticated
  using (public.tiene_permiso(catalog_id, 'usuarios') and role <> 'admin')
  with check (public.tiene_permiso(catalog_id, 'usuarios') and role <> 'admin');
create policy "members: permiso usuarios borra" on public.catalog_members
  for delete to authenticated
  using (public.tiene_permiso(catalog_id, 'usuarios') and role <> 'admin');

-- ------------------------------------------------------------
-- ajustar_costo_proveedor / propagar_costo_proveedor: pasan de
-- can_manage_prices a can_manage_costs (son costo de proveedor, no
-- precio de venta — permiso separado). Misma firma y lógica.
-- ------------------------------------------------------------
create or replace function public.ajustar_costo_proveedor(
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
  if not public.can_manage_costs(p_catalog_id) then
    raise exception 'No tenés permiso para modificar costos de proveedores' using errcode = '42501';
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

create or replace function public.propagar_costo_proveedor(
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
  if not public.can_manage_costs(p_catalog_id) then
    raise exception 'No tenés permiso para modificar costos de proveedores' using errcode = '42501';
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
