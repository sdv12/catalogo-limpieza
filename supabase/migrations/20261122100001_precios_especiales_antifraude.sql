-- ============================================================
-- Precios especiales por cliente + cierre de huecos antifraude.
--
-- 1. customer_prices: precio especial de UNA presentación para UN
--    cliente. No toca variant_prices (el precio general) ni la tienda
--    online (las funciones storefront_* no la leen). Motivo
--    obligatorio, vencimiento opcional, todo auditado. Por debajo del
--    costo, solo un administrador.
--    Permiso nuevo: precios_especiales (admin siempre).
--
-- 2. Antifraude (un empleado sin permisos extra ya no puede):
--    a) cargar ajustes / notas de crédito / notas de débito en cuenta
--       corriente (solo cargo y pago) → exige cuenta_corriente_admin;
--    b) cambiar el nivel de precio de un cliente → exige precios_lote;
--    c) modificar o borrar el precio general de un producto ya
--       cargado → exige precios_lote (puede seguir poniendo precio al
--       crear un producto o una presentación nueva).
-- ============================================================

-- ------------------------------------------------------------
-- Permiso nuevo
-- ------------------------------------------------------------
alter table public.catalog_members
  drop constraint catalog_members_permissions_check;
alter table public.catalog_members
  add constraint catalog_members_permissions_check
  check (permissions <@ array[
    'precios_lote', 'costos', 'carga_masiva', 'promos',
    'cuenta_corriente_admin', 'usuarios', 'precios_especiales'
  ]::text[]);

comment on column public.catalog_members.permissions is
  'Permisos extra para role=empleado. admin/viewer la ignoran. Valores: precios_lote, costos, carga_masiva, promos, cuenta_corriente_admin, usuarios, precios_especiales.';

-- ------------------------------------------------------------
-- 1. customer_prices
-- ------------------------------------------------------------
create table public.customer_prices (
  id          uuid primary key default gen_random_uuid(),
  catalog_id  uuid not null references public.catalogs(id) on delete cascade,
  customer_id uuid not null,
  variant_id  uuid not null,
  price       numeric(12, 2) not null check (price >= 0),
  reason      text not null check (length(btrim(reason)) >= 3),
  ends_on     date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  updated_by  uuid references auth.users(id),
  unique (customer_id, variant_id),
  foreign key (customer_id, catalog_id)
    references public.customers (id, catalog_id) on delete cascade,
  foreign key (variant_id, catalog_id)
    references public.product_variants (id, catalog_id) on delete cascade
);

comment on table public.customer_prices is
  'Precio especial de una presentación para un cliente puntual. No modifica el precio general ni se publica en la tienda. ends_on null = sin vencimiento (vale hasta ese día inclusive).';

create index customer_prices_customer_idx on public.customer_prices (customer_id);
create index customer_prices_variant_idx on public.customer_prices (variant_id);

alter table public.customer_prices enable row level security;

create policy "customer_prices: miembro lee" on public.customer_prices
  for select to authenticated using (public.is_catalog_member(catalog_id));
create policy "customer_prices: permiso inserta" on public.customer_prices
  for insert to authenticated
  with check (public.tiene_permiso(catalog_id, 'precios_especiales'));
create policy "customer_prices: permiso edita" on public.customer_prices
  for update to authenticated
  using (public.tiene_permiso(catalog_id, 'precios_especiales'))
  with check (public.tiene_permiso(catalog_id, 'precios_especiales'));
create policy "customer_prices: permiso borra" on public.customer_prices
  for delete to authenticated
  using (public.tiene_permiso(catalog_id, 'precios_especiales'));

create trigger touch_customer_prices
  before update on public.customer_prices
  for each row execute function public.touch_updated_at();

-- Un precio especial por debajo del costo solo lo puede dar un admin
-- (un empleado con el permiso no puede regalar mercadería).
create or replace function public.protect_customer_price_below_cost()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost numeric;
begin
  if auth.uid() is null or public.is_catalog_admin(new.catalog_id) then
    return new;
  end if;
  select pv.cost into v_cost from public.product_variants pv where pv.id = new.variant_id;
  if v_cost is not null and v_cost > 0 and new.price < v_cost then
    raise exception 'Un precio especial por debajo del costo solo lo puede dar un administrador'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger protect_customer_price_below_cost
  before insert or update of price, variant_id on public.customer_prices
  for each row execute function public.protect_customer_price_below_cost();

alter table public.audit_log drop constraint audit_log_entity_type_check;
alter table public.audit_log add constraint audit_log_entity_type_check
  check (entity_type in ('product', 'variant', 'price', 'stock', 'category', 'image',
                         'catalog', 'member', 'customer', 'supplier', 'product_supplier',
                         'promotion', 'customer_transaction', 'customer_price'));

create trigger audit_customer_prices
  after insert or update or delete on public.customer_prices
  for each row execute function public.fn_audit('customer_price');

-- ------------------------------------------------------------
-- 2a. Cuenta corriente: el empleado base solo carga cargo y pago
-- ------------------------------------------------------------
drop policy if exists "customer_transactions: editor inserta" on public.customer_transactions;
drop policy if exists "customer_transactions: miembro inserta" on public.customer_transactions;
drop policy if exists "customer_transactions: inserta" on public.customer_transactions;

create policy "customer_transactions: inserta" on public.customer_transactions
  for insert to authenticated
  with check (
    public.can_edit_catalog(catalog_id)
    and (
      kind in ('cargo', 'pago')
      or public.tiene_permiso(catalog_id, 'cuenta_corriente_admin')
    )
  );

-- ------------------------------------------------------------
-- 2b. Nivel de precio del cliente: cambiarlo exige precios_lote.
--     Al dar de alta, el empleado puede dejarlo vacío o en el nivel
--     por defecto del catálogo.
-- ------------------------------------------------------------
create or replace function public.protect_customer_price_tier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;  -- tareas de sistema (service_role)
  end if;
  if public.tiene_permiso(new.catalog_id, 'precios_lote') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.price_tier_id is not null and not exists (
      select 1 from public.price_tiers t
      where t.id = new.price_tier_id and t.is_default
    ) then
      raise exception 'Asignar un nivel de precio distinto del general requiere el permiso de precios'
        using errcode = '42501';
    end if;
  elsif new.price_tier_id is distinct from old.price_tier_id then
    raise exception 'Cambiar el nivel de precio de un cliente requiere el permiso de precios'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger protect_customer_price_tier
  before insert or update of price_tier_id on public.customers
  for each row execute function public.protect_customer_price_tier();

-- ------------------------------------------------------------
-- 2c. Precio general ya cargado: modificar/borrar exige precios_lote
--     (insertar sigue siendo base: precio de producto/presentación nueva)
-- ------------------------------------------------------------
drop policy if exists "variant_prices: editor edita" on public.variant_prices;
drop policy if exists "variant_prices: editor borra" on public.variant_prices;

create policy "variant_prices: permiso edita" on public.variant_prices
  for update to authenticated
  using (public.can_manage_prices(catalog_id))
  with check (public.can_manage_prices(catalog_id));
create policy "variant_prices: permiso borra" on public.variant_prices
  for delete to authenticated using (public.can_manage_prices(catalog_id));
