-- ============================================================
-- Ventas / pedidos + bandeja única de canales.
--
-- Flujo: nuevo → confirmado → preparando → en_reparto → entregado
--        (cancelado desde cualquier estado previo a entregado)
--
-- Reglas (todas acá, en la base, no solo en la pantalla):
-- - Los precios los calcula la base: precio especial vigente del
--   cliente, si no el de su nivel, si no el del nivel por defecto.
-- - Cambiar un precio dentro de la venta exige el permiso
--   precios_especiales + motivo; por debajo del costo, solo admin.
-- - Al CONFIRMAR: se descuenta el stock (bloquea si no alcanza), se
--   carga la deuda si es a cuenta corriente y se controla el límite de
--   crédito (superarlo: solo admin).
-- - Cancelar un pedido ya confirmado: solo admin; devuelve el stock y
--   anula el cargo de cuenta corriente. Entregado no se cancela.
-- - Pedidos de tiendas / bot: entran como "nuevo" al precio general
--   y no tocan stock ni deuda hasta que alguien del panel confirma.
-- - Nadie escribe orders / order_items directo: solo vía funciones.
-- ============================================================

-- ------------------------------------------------------------
-- Tablas
-- ------------------------------------------------------------
create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  catalog_id       uuid not null references public.catalogs(id) on delete cascade,
  number           integer not null,
  channel          text not null default 'panel'
                   check (channel in ('panel', 'tienda', 'whatsapp', 'otro')),
  channel_name     text,
  external_ref     text,
  status           text not null default 'nuevo'
                   check (status in ('nuevo', 'confirmado', 'preparando',
                                     'en_reparto', 'entregado', 'cancelado')),
  customer_id      uuid,
  contact_name     text,
  contact_phone    text,
  contact_email    text,
  delivery_address text,
  notes            text,
  payment_terms    text not null default 'contado'
                   check (payment_terms in ('contado', 'cuenta_corriente')),
  due_date         date,
  total            numeric(14, 2) not null default 0,
  confirmed_at     timestamptz,
  confirmed_by     uuid references auth.users(id),
  delivered_at     timestamptz,
  delivered_by     uuid references auth.users(id),
  cancelled_at     timestamptz,
  cancelled_by     uuid references auth.users(id),
  cancel_reason    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references auth.users(id),
  updated_by       uuid references auth.users(id),
  unique (id, catalog_id),
  unique (catalog_id, number),
  foreign key (customer_id, catalog_id)
    references public.customers (id, catalog_id) on delete restrict,
  check (payment_terms <> 'cuenta_corriente' or customer_id is not null)
);

create unique index orders_external_ref_uq
  on public.orders (catalog_id, channel, external_ref)
  where external_ref is not null;
create index orders_catalog_status_idx on public.orders (catalog_id, status, created_at desc);
create index orders_customer_idx on public.orders (customer_id);

comment on table public.orders is
  'Pedidos/ventas. Se escriben solo vía funciones (guardar_pedido, confirmar_pedido, avanzar_pedido, cancelar_pedido, crear_pedido_externo).';

create table public.order_items (
  id             uuid primary key default gen_random_uuid(),
  catalog_id     uuid not null references public.catalogs(id) on delete cascade,
  order_id       uuid not null,
  variant_id     uuid not null,
  position       integer not null default 0,
  product_name   text not null,
  variant_name   text not null,
  sku            text not null,
  quantity       numeric not null check (quantity > 0),
  list_price     numeric(12, 2),
  unit_price     numeric(12, 2) not null check (unit_price >= 0),
  price_source   text not null check (price_source in ('lista', 'especial', 'manual')),
  price_reason   text,
  save_special   boolean not null default false,
  unit_cost      numeric,
  line_total     numeric(14, 2) not null,
  created_at     timestamptz not null default now(),
  foreign key (order_id, catalog_id)
    references public.orders (id, catalog_id) on delete cascade,
  foreign key (variant_id, catalog_id)
    references public.product_variants (id, catalog_id) on delete restrict
);

create index order_items_order_idx on public.order_items (order_id, position);
create index order_items_variant_idx on public.order_items (variant_id);

-- Trazabilidad: stock y cuenta corriente saben de qué pedido vienen.
alter table public.stock_movements
  add column order_id uuid references public.orders(id) on delete set null;
alter table public.customer_transactions
  add column order_id uuid references public.orders(id) on delete set null;

-- Claves de los canales externos (tiendas, bot). Se guarda solo el hash.
create table public.channel_keys (
  id           uuid primary key default gen_random_uuid(),
  catalog_id   uuid not null references public.catalogs(id) on delete cascade,
  channel      text not null check (channel in ('tienda', 'whatsapp', 'otro')),
  name         text not null,
  key_prefix   text not null,
  key_hash     text not null unique,
  is_active    boolean not null default true,
  last_used_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id),
  updated_by   uuid references auth.users(id)
);

-- ------------------------------------------------------------
-- RLS: lectura para miembros; escritura solo vía funciones
-- ------------------------------------------------------------
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.channel_keys enable row level security;

create policy "orders: miembro lee" on public.orders
  for select to authenticated using (public.is_catalog_member(catalog_id));
create policy "order_items: miembro lee" on public.order_items
  for select to authenticated using (public.is_catalog_member(catalog_id));

create policy "channel_keys: admin lee" on public.channel_keys
  for select to authenticated using (public.is_catalog_admin(catalog_id));
create policy "channel_keys: admin inserta" on public.channel_keys
  for insert to authenticated with check (public.is_catalog_admin(catalog_id));
create policy "channel_keys: admin edita" on public.channel_keys
  for update to authenticated
  using (public.is_catalog_admin(catalog_id))
  with check (public.is_catalog_admin(catalog_id));
create policy "channel_keys: admin borra" on public.channel_keys
  for delete to authenticated using (public.is_catalog_admin(catalog_id));

-- ------------------------------------------------------------
-- Triggers comunes
-- ------------------------------------------------------------
create trigger touch_orders before update on public.orders
  for each row execute function public.touch_updated_at();
create trigger touch_channel_keys before update on public.channel_keys
  for each row execute function public.touch_updated_at();

-- número correlativo por catálogo
create or replace function public.fn_numerar_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('orders:' || new.catalog_id::text));
  select coalesce(max(number), 0) + 1 into new.number
    from public.orders where catalog_id = new.catalog_id;
  return new;
end;
$$;

create trigger numerar_pedido before insert on public.orders
  for each row execute function public.fn_numerar_pedido();

alter table public.audit_log drop constraint audit_log_entity_type_check;
alter table public.audit_log add constraint audit_log_entity_type_check
  check (entity_type in ('product', 'variant', 'price', 'stock', 'category', 'image',
                         'catalog', 'member', 'customer', 'supplier', 'product_supplier',
                         'promotion', 'customer_transaction', 'customer_price',
                         'order', 'order_item', 'channel_key'));

create trigger audit_orders after insert or update or delete on public.orders
  for each row execute function public.fn_audit('order');
create trigger audit_order_items after insert or update or delete on public.order_items
  for each row execute function public.fn_audit('order_item');
create trigger audit_channel_keys after insert or update or delete on public.channel_keys
  for each row execute function public.fn_audit('channel_key');

-- ------------------------------------------------------------
-- Fecha de hoy en Argentina (los vencimientos son fechas locales)
-- ------------------------------------------------------------
create or replace function public.hoy_ar()
returns date
language sql
stable
as $$ select (now() at time zone 'America/Argentina/Cordoba')::date; $$;

-- ------------------------------------------------------------
-- precio_de_lista: qué precio le corresponde a un cliente (o al
-- público, si p_customer es null) por una presentación.
-- ------------------------------------------------------------
create or replace function public.precio_de_lista(p_variant uuid, p_customer uuid)
returns table (price numeric, source text)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_catalog uuid;
  v_tier    uuid;
  v_price   numeric;
begin
  select pv.catalog_id into v_catalog from public.product_variants pv where pv.id = p_variant;
  if v_catalog is null then
    return;
  end if;

  if p_customer is not null then
    select cp.price into v_price from public.customer_prices cp
      where cp.customer_id = p_customer and cp.variant_id = p_variant
        and (cp.ends_on is null or cp.ends_on >= public.hoy_ar());
    if v_price is not null then
      price := v_price; source := 'especial'; return next; return;
    end if;
    select c.price_tier_id into v_tier from public.customers c where c.id = p_customer;
  end if;

  if v_tier is not null then
    select vp.price into v_price from public.variant_prices vp
      where vp.variant_id = p_variant and vp.price_tier_id = v_tier;
  end if;
  if v_price is null then
    select vp.price into v_price
      from public.variant_prices vp
      join public.price_tiers t on t.id = vp.price_tier_id and t.is_default
      where vp.variant_id = p_variant;
  end if;

  price := v_price; source := 'lista'; return next;
end;
$$;

grant execute on function public.precio_de_lista(uuid, uuid) to authenticated;
revoke execute on function public.precio_de_lista(uuid, uuid) from anon;

-- ------------------------------------------------------------
-- _cargar_items_pedido (interna): valida y carga los renglones.
-- p_items: [{variant_id, quantity, unit_price?, reason?, save_special?}]
-- p_externo: true = canal externo (ignora unit_price, siempre lista).
-- ------------------------------------------------------------
create or replace function public._cargar_items_pedido(
  p_order    uuid,
  p_catalog  uuid,
  p_customer uuid,
  p_items    jsonb,
  p_externo  boolean
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item     jsonb;
  v_pos      integer := 0;
  v_variant  record;
  v_qty      numeric;
  v_lista    numeric;
  v_source   text;
  v_unit     numeric;
  v_manual   boolean;
  v_reason   text;
  v_special  boolean;
  v_total    numeric := 0;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido no tiene productos';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'Máximo 200 renglones por pedido';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_pos := v_pos + 1;

    select pv.id, pv.name, pv.sku, pv.cost, p.name as product_name
      into v_variant
      from public.product_variants pv
      join public.products p on p.id = pv.product_id
      where pv.id = (v_item->>'variant_id')::uuid
        and pv.catalog_id = p_catalog
        and pv.is_deleted = false and p.is_deleted = false;
    if not found then
      raise exception 'Renglón %: el producto no existe en este catálogo', v_pos;
    end if;

    v_qty := (v_item->>'quantity')::numeric;
    if v_qty is null or v_qty <= 0 or v_qty > 100000 then
      raise exception 'Renglón % (%): cantidad inválida', v_pos, v_variant.product_name;
    end if;

    select l.price, l.source into v_lista, v_source
      from public.precio_de_lista(v_variant.id, p_customer) l;

    v_unit := case when p_externo then null else (v_item->>'unit_price')::numeric end;
    v_reason := nullif(btrim(coalesce(v_item->>'reason', '')), '');
    v_special := not p_externo and coalesce((v_item->>'save_special')::boolean, false);

    if v_unit is null then
      if v_lista is null then
        raise exception 'Renglón % (% %): no tiene precio cargado', v_pos,
          v_variant.product_name, v_variant.name;
      end if;
      v_unit := v_lista;
    end if;
    v_unit := round(v_unit, 2);
    if v_unit < 0 then
      raise exception 'Renglón %: el precio no puede ser negativo', v_pos;
    end if;

    v_manual := v_lista is null or v_unit <> round(v_lista, 2);
    if v_manual then
      if not public.tiene_permiso(p_catalog, 'precios_especiales') then
        raise exception 'Cambiar el precio en una venta requiere el permiso de precios especiales'
          using errcode = '42501';
      end if;
      if v_reason is null or length(v_reason) < 3 then
        raise exception 'Renglón % (%): escribí el motivo del cambio de precio', v_pos,
          v_variant.product_name;
      end if;
      if v_variant.cost is not null and v_variant.cost > 0 and v_unit < v_variant.cost
         and not public.is_catalog_admin(p_catalog) then
        raise exception 'Renglón % (%): por debajo del costo solo lo puede vender un administrador',
          v_pos, v_variant.product_name using errcode = '42501';
      end if;
      v_source := 'manual';
    else
      v_reason := null;
      v_special := false;
    end if;

    if v_special and p_customer is null then
      raise exception 'Para guardar un precio fijo hay que elegir un cliente';
    end if;

    insert into public.order_items (
      catalog_id, order_id, variant_id, position, product_name, variant_name, sku,
      quantity, list_price, unit_price, price_source, price_reason, save_special,
      unit_cost, line_total
    ) values (
      p_catalog, p_order, v_variant.id, v_pos, v_variant.product_name, v_variant.name,
      v_variant.sku, v_qty, v_lista, v_unit, v_source, v_reason, v_special,
      v_variant.cost, round(v_qty * v_unit, 2)
    );
    v_total := v_total + round(v_qty * v_unit, 2);
  end loop;

  return v_total;
end;
$$;

revoke execute on function public._cargar_items_pedido(uuid, uuid, uuid, jsonb, boolean) from public, anon, authenticated;

-- ------------------------------------------------------------
-- guardar_pedido: crea o edita un pedido en estado "nuevo"
-- ------------------------------------------------------------
create or replace function public.guardar_pedido(
  p_catalog   uuid,
  p_order     uuid,
  p_customer  uuid,
  p_payment   text,
  p_due_date  date,
  p_notes     text,
  p_items     jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_total numeric;
begin
  if auth.uid() is null or not public.can_edit_catalog(p_catalog) then
    raise exception 'Sin permiso para cargar ventas en este catálogo' using errcode = '42501';
  end if;
  if p_payment not in ('contado', 'cuenta_corriente') then
    raise exception 'Condición de pago inválida';
  end if;
  if p_payment = 'cuenta_corriente' and p_customer is null then
    raise exception 'Una venta a cuenta corriente necesita un cliente';
  end if;
  if p_customer is not null and not exists (
    select 1 from public.customers c
    where c.id = p_customer and c.catalog_id = p_catalog and c.is_deleted = false
  ) then
    raise exception 'El cliente no existe en este catálogo';
  end if;

  if p_order is null then
    insert into public.orders (
      catalog_id, channel, customer_id, payment_terms, due_date, notes,
      created_by, updated_by
    ) values (
      p_catalog, 'panel', p_customer, p_payment,
      case when p_payment = 'cuenta_corriente' then p_due_date end,
      nullif(btrim(coalesce(p_notes, '')), ''), auth.uid(), auth.uid()
    ) returning * into v_order;
  else
    select * into v_order from public.orders
      where id = p_order and catalog_id = p_catalog for update;
    if not found then
      raise exception 'El pedido no existe';
    end if;
    if v_order.status <> 'nuevo' then
      raise exception 'Solo se puede editar un pedido en estado Nuevo';
    end if;
    update public.orders set
      customer_id = p_customer,
      payment_terms = p_payment,
      due_date = case when p_payment = 'cuenta_corriente' then p_due_date end,
      notes = nullif(btrim(coalesce(p_notes, '')), ''),
      updated_by = auth.uid()
      where id = p_order;
    delete from public.order_items where order_id = p_order;
  end if;

  v_total := public._cargar_items_pedido(v_order.id, p_catalog, p_customer, p_items, false);
  update public.orders set total = v_total where id = v_order.id;
  return v_order.id;
end;
$$;

grant execute on function public.guardar_pedido(uuid, uuid, uuid, text, date, text, jsonb) to authenticated;
revoke execute on function public.guardar_pedido(uuid, uuid, uuid, text, date, text, jsonb) from anon;

-- ------------------------------------------------------------
-- confirmar_pedido: descuenta stock, carga deuda, guarda precios fijos
-- ------------------------------------------------------------
create or replace function public.confirmar_pedido(p_order uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order    public.orders;
  v_customer public.customers;
  v_item     record;
  v_prev     numeric;
  v_falta    text := '';
begin
  select * into v_order from public.orders where id = p_order for update;
  if not found then
    raise exception 'El pedido no existe';
  end if;
  if auth.uid() is null or not public.can_edit_catalog(v_order.catalog_id) then
    raise exception 'Sin permiso para confirmar ventas en este catálogo' using errcode = '42501';
  end if;
  if v_order.status <> 'nuevo' then
    raise exception 'El pedido ya no está en estado Nuevo';
  end if;
  if not exists (select 1 from public.order_items where order_id = p_order) then
    raise exception 'El pedido no tiene productos';
  end if;

  -- límite de cuenta corriente
  if v_order.payment_terms = 'cuenta_corriente' then
    select * into v_customer from public.customers where id = v_order.customer_id;
    if v_customer.credit_limit > 0
       and v_customer.balance + v_order.total > v_customer.credit_limit
       and not public.is_catalog_admin(v_order.catalog_id) then
      raise exception 'Con esta venta el cliente supera su límite de cuenta corriente (%): solo un administrador puede confirmarla',
        v_customer.credit_limit using errcode = '42501';
    end if;
  end if;

  -- stock suficiente (se bloquean las filas para que dos ventas no lo pisen)
  for v_item in
    select oi.variant_id, sum(oi.quantity) as qty, min(oi.product_name) as product_name,
           min(oi.variant_name) as variant_name
      from public.order_items oi where oi.order_id = p_order
      group by oi.variant_id
  loop
    select stock into v_prev from public.product_variants
      where id = v_item.variant_id for update;
    if v_prev < v_item.qty then
      v_falta := v_falta || format(E'\n- %s %s: hay %s, pide %s',
        v_item.product_name, v_item.variant_name, v_prev, v_item.qty);
    end if;
  end loop;
  if v_falta <> '' then
    raise exception 'No hay stock suficiente:%', v_falta;
  end if;

  -- descontar stock
  perform set_config('app.audit_action', 'stock_adjust', true);
  perform set_config('app.stock_reason', 'venta', true);
  for v_item in
    select oi.variant_id, sum(oi.quantity) as qty
      from public.order_items oi where oi.order_id = p_order
      group by oi.variant_id
  loop
    update public.product_variants
      set stock = stock - v_item.qty, updated_by = auth.uid()
      where id = v_item.variant_id
      returning stock + v_item.qty into v_prev;
    insert into public.stock_movements (
      catalog_id, variant_id, delta, reason, note, previous_stock, new_stock,
      created_by, order_id
    ) values (
      v_order.catalog_id, v_item.variant_id, -v_item.qty, 'venta',
      'Pedido #' || v_order.number, v_prev, v_prev - v_item.qty, auth.uid(), p_order
    );
  end loop;
  perform set_config('app.audit_action', '', true);
  perform set_config('app.stock_reason', '', true);

  -- deuda en cuenta corriente
  if v_order.payment_terms = 'cuenta_corriente' and v_order.total > 0 then
    insert into public.customer_transactions (
      catalog_id, customer_id, kind, amount, due_date, note, order_id,
      created_by, updated_by
    ) values (
      v_order.catalog_id, v_order.customer_id, 'cargo', v_order.total,
      coalesce(v_order.due_date, public.hoy_ar() + 30),
      'Pedido #' || v_order.number, p_order, auth.uid(), auth.uid()
    );
  end if;

  -- precios que se pidió dejar fijos para el cliente
  insert into public.customer_prices (
    catalog_id, customer_id, variant_id, price, reason, created_by, updated_by
  )
  select distinct on (oi.variant_id)
         v_order.catalog_id, v_order.customer_id, oi.variant_id, oi.unit_price,
         oi.price_reason || ' (pedido #' || v_order.number || ')', auth.uid(), auth.uid()
    from public.order_items oi
    where oi.order_id = p_order and oi.save_special and v_order.customer_id is not null
    order by oi.variant_id, oi.position desc
  on conflict (customer_id, variant_id) do update
    set price = excluded.price, reason = excluded.reason,
        ends_on = null, updated_by = excluded.updated_by;

  update public.orders set
    status = 'confirmado', confirmed_at = now(), confirmed_by = auth.uid(),
    updated_by = auth.uid()
    where id = p_order;
end;
$$;

grant execute on function public.confirmar_pedido(uuid) to authenticated;
revoke execute on function public.confirmar_pedido(uuid) from anon;

-- ------------------------------------------------------------
-- avanzar_pedido: confirmado → preparando → en_reparto → entregado
-- ------------------------------------------------------------
create or replace function public.avanzar_pedido(p_order uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_orden constant text[] := array['confirmado', 'preparando', 'en_reparto', 'entregado'];
begin
  select * into v_order from public.orders where id = p_order for update;
  if not found then
    raise exception 'El pedido no existe';
  end if;
  if auth.uid() is null or not public.can_edit_catalog(v_order.catalog_id) then
    raise exception 'Sin permiso en este catálogo' using errcode = '42501';
  end if;
  if not (p_status = any (v_orden)) or not (v_order.status = any (v_orden)) then
    raise exception 'Cambio de estado inválido';
  end if;
  if array_position(v_orden, p_status) <= array_position(v_orden, v_order.status) then
    raise exception 'El pedido solo puede avanzar de estado';
  end if;

  update public.orders set
    status = p_status,
    delivered_at = case when p_status = 'entregado' then now() else delivered_at end,
    delivered_by = case when p_status = 'entregado' then auth.uid() else delivered_by end,
    updated_by = auth.uid()
    where id = p_order;
end;
$$;

grant execute on function public.avanzar_pedido(uuid, text) to authenticated;
revoke execute on function public.avanzar_pedido(uuid, text) from anon;

-- ------------------------------------------------------------
-- cancelar_pedido
-- ------------------------------------------------------------
create or replace function public.cancelar_pedido(p_order uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_item  record;
  v_prev  numeric;
begin
  select * into v_order from public.orders where id = p_order for update;
  if not found then
    raise exception 'El pedido no existe';
  end if;
  if auth.uid() is null or not public.can_edit_catalog(v_order.catalog_id) then
    raise exception 'Sin permiso en este catálogo' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Escribí el motivo de la cancelación';
  end if;
  if v_order.status in ('cancelado', 'entregado') then
    raise exception 'Un pedido % no se puede cancelar', v_order.status;
  end if;

  if v_order.status <> 'nuevo' then
    if not public.is_catalog_admin(v_order.catalog_id) then
      raise exception 'Cancelar un pedido ya confirmado es solo para administradores'
        using errcode = '42501';
    end if;

    -- devolver stock
    perform set_config('app.audit_action', 'stock_adjust', true);
    perform set_config('app.stock_reason', 'ajuste', true);
    for v_item in
      select oi.variant_id, sum(oi.quantity) as qty
        from public.order_items oi where oi.order_id = p_order
        group by oi.variant_id
    loop
      update public.product_variants
        set stock = stock + v_item.qty, updated_by = auth.uid()
        where id = v_item.variant_id
        returning stock - v_item.qty into v_prev;
      insert into public.stock_movements (
        catalog_id, variant_id, delta, reason, note, previous_stock, new_stock,
        created_by, order_id
      ) values (
        v_order.catalog_id, v_item.variant_id, v_item.qty, 'ajuste',
        'Cancelación pedido #' || v_order.number, v_prev, v_prev + v_item.qty,
        auth.uid(), p_order
      );
    end loop;
    perform set_config('app.audit_action', '', true);
    perform set_config('app.stock_reason', '', true);

    -- anular el cargo de cuenta corriente
    update public.customer_transactions set
      is_deleted = true, deleted_at = now(), deleted_by = auth.uid(), updated_by = auth.uid()
      where order_id = p_order and is_deleted = false;
  end if;

  update public.orders set
    status = 'cancelado', cancelled_at = now(), cancelled_by = auth.uid(),
    cancel_reason = btrim(p_reason), updated_by = auth.uid()
    where id = p_order;
end;
$$;

grant execute on function public.cancelar_pedido(uuid, text) to authenticated;
revoke execute on function public.cancelar_pedido(uuid, text) from anon;

-- ------------------------------------------------------------
-- crear_pedido_externo: lo llama SOLO el servidor del panel (service
-- role) después de validar la clave del canal. Precio general siempre;
-- no toca stock ni deuda. Idempotente por external_ref.
-- p_payload: {referencia?, cliente:{nombre,telefono?,email?,direccion?},
--             notas?, items:[{sku, cantidad}]}
-- ------------------------------------------------------------
create or replace function public.crear_pedido_externo(
  p_key_id  uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key    public.channel_keys;
  v_ref    text := nullif(btrim(coalesce(p_payload->>'referencia', '')), '');
  v_order  public.orders;
  v_items  jsonb := '[]'::jsonb;
  v_it     jsonb;
  v_vid    uuid;
  v_total  numeric;
  v_nombre text := nullif(btrim(coalesce(p_payload#>>'{cliente,nombre}', '')), '');
begin
  select * into v_key from public.channel_keys where id = p_key_id and is_active;
  if not found then
    raise exception 'Clave de canal inválida' using errcode = '42501';
  end if;
  if v_nombre is null then
    raise exception 'Falta cliente.nombre';
  end if;
  if jsonb_typeof(p_payload->'items') <> 'array' then
    raise exception 'Faltan los items';
  end if;

  -- idempotencia: el mismo pedido reenviado devuelve el existente
  if v_ref is not null then
    select * into v_order from public.orders
      where catalog_id = v_key.catalog_id and channel = v_key.channel and external_ref = v_ref;
    if found then
      return jsonb_build_object('id', v_order.id, 'numero', v_order.number,
        'estado', v_order.status, 'total', v_order.total, 'duplicado', true);
    end if;
  end if;

  for v_it in select * from jsonb_array_elements(p_payload->'items') loop
    v_vid := null;
    select pv.id into v_vid from public.product_variants pv
      where pv.catalog_id = v_key.catalog_id and pv.sku = v_it->>'sku' and pv.is_deleted = false;
    if v_vid is null then
      raise exception 'SKU inexistente: %', coalesce(v_it->>'sku', '(vacío)');
    end if;
    v_items := v_items || jsonb_build_object('variant_id', v_vid, 'quantity', v_it->'cantidad');
  end loop;

  -- escritura de sistema: sin usuario del panel (no audita, queda el canal)
  perform set_config('app.allow_system_write', 'on', true);

  insert into public.orders (
    catalog_id, channel, channel_name, external_ref, contact_name, contact_phone,
    contact_email, delivery_address, notes
  ) values (
    v_key.catalog_id, v_key.channel, v_key.name, v_ref, left(v_nombre, 200),
    left(nullif(btrim(coalesce(p_payload#>>'{cliente,telefono}', '')), ''), 50),
    left(nullif(btrim(coalesce(p_payload#>>'{cliente,email}', '')), ''), 200),
    left(nullif(btrim(coalesce(p_payload#>>'{cliente,direccion}', '')), ''), 300),
    left(nullif(btrim(coalesce(p_payload->>'notas', '')), ''), 1000)
  ) returning * into v_order;

  v_total := public._cargar_items_pedido(v_order.id, v_key.catalog_id, null, v_items, true);
  update public.orders set total = v_total where id = v_order.id;
  update public.channel_keys set last_used_at = now() where id = v_key.id;

  perform set_config('app.allow_system_write', 'off', true);

  return jsonb_build_object('id', v_order.id, 'numero', v_order.number,
    'estado', 'nuevo', 'total', v_total, 'duplicado', false);
end;
$$;

revoke execute on function public.crear_pedido_externo(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.crear_pedido_externo(uuid, jsonb) to service_role;
