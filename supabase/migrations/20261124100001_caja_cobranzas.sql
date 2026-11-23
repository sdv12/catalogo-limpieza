-- ============================================================
-- Caja y cobranzas.
--
-- - Una caja por persona (cash_sessions): se abre con el efectivo
--   inicial y se cierra contando el efectivo; queda la diferencia.
-- - Cada cobro es un recibo numerado (receipts + receipt_lines), con uno
--   o varios medios de pago. No se borra: un admin (o permiso
--   caja_admin) lo anula con motivo.
-- - Cobro de cuenta corriente → genera el "pago" en la cuenta del
--   cliente. Desde ahora un empleado base ya no carga "Pago recibido" a
--   mano: pasa por la caja con recibo (permiso cuenta_corriente_admin sí).
-- - Venta de contado: se cobra al confirmar, o queda "a cobrar" (contra
--   entrega) y no se puede marcar Entregada sin cobrarla.
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
    'cuenta_corriente_admin', 'usuarios', 'precios_especiales', 'caja_admin'
  ]::text[]);

-- ------------------------------------------------------------
-- Tablas
-- ------------------------------------------------------------
create table public.cash_sessions (
  id              uuid primary key default gen_random_uuid(),
  catalog_id      uuid not null references public.catalogs(id) on delete cascade,
  user_id         uuid not null references auth.users(id),
  status          text not null default 'abierta' check (status in ('abierta', 'cerrada')),
  opened_at       timestamptz not null default now(),
  opening_amount  numeric(14, 2) not null default 0 check (opening_amount >= 0),
  closed_at       timestamptz,
  closed_by       uuid references auth.users(id),
  expected_cash   numeric(14, 2),
  counted_cash    numeric(14, 2) check (counted_cash is null or counted_cash >= 0),
  difference      numeric(14, 2),
  closing_note    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (id, catalog_id)
);

create unique index cash_sessions_una_abierta
  on public.cash_sessions (catalog_id, user_id) where status = 'abierta';
create index cash_sessions_catalog_idx on public.cash_sessions (catalog_id, opened_at desc);

create table public.receipts (
  id           uuid primary key default gen_random_uuid(),
  catalog_id   uuid not null references public.catalogs(id) on delete cascade,
  number       integer not null,
  session_id   uuid not null,
  customer_id  uuid,
  order_id     uuid,
  total        numeric(14, 2) not null check (total > 0),
  note         text,
  status       text not null default 'valido' check (status in ('valido', 'anulado')),
  voided_at    timestamptz,
  voided_by    uuid references auth.users(id),
  void_reason  text,
  emailed_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid not null references auth.users(id),
  unique (id, catalog_id),
  unique (catalog_id, number),
  foreign key (session_id, catalog_id)
    references public.cash_sessions (id, catalog_id) on delete restrict,
  foreign key (customer_id, catalog_id)
    references public.customers (id, catalog_id) on delete restrict,
  foreign key (order_id, catalog_id)
    references public.orders (id, catalog_id) on delete restrict,
  check (customer_id is not null or order_id is not null)
);

create index receipts_session_idx on public.receipts (session_id);
create index receipts_customer_idx on public.receipts (customer_id, created_at desc);
create index receipts_order_idx on public.receipts (order_id);

create table public.receipt_lines (
  id          uuid primary key default gen_random_uuid(),
  catalog_id  uuid not null references public.catalogs(id) on delete cascade,
  receipt_id  uuid not null,
  method      text not null
              check (method in ('efectivo', 'transferencia', 'mercado_pago', 'debito', 'credito')),
  amount      numeric(14, 2) not null check (amount > 0),
  reference   text,
  foreign key (receipt_id, catalog_id)
    references public.receipts (id, catalog_id) on delete cascade
);

create index receipt_lines_receipt_idx on public.receipt_lines (receipt_id);

create table public.cash_movements (
  id          uuid primary key default gen_random_uuid(),
  catalog_id  uuid not null references public.catalogs(id) on delete cascade,
  session_id  uuid not null,
  kind        text not null check (kind in ('ingreso', 'egreso')),
  amount      numeric(14, 2) not null check (amount > 0),
  reason      text not null check (length(btrim(reason)) >= 3),
  created_at  timestamptz not null default now(),
  created_by  uuid not null references auth.users(id),
  foreign key (session_id, catalog_id)
    references public.cash_sessions (id, catalog_id) on delete restrict
);

create index cash_movements_session_idx on public.cash_movements (session_id);

-- trazabilidad
alter table public.customer_transactions
  add column receipt_id uuid references public.receipts(id) on delete set null;
alter table public.orders
  add column paid_total numeric(14, 2) not null default 0,
  add column collect_on_delivery boolean not null default false;

-- ------------------------------------------------------------
-- RLS: solo lectura; todo se escribe vía funciones
-- ------------------------------------------------------------
alter table public.cash_sessions enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_lines enable row level security;
alter table public.cash_movements enable row level security;

create policy "cash_sessions: propia o caja_admin" on public.cash_sessions
  for select to authenticated
  using (user_id = auth.uid() or public.tiene_permiso(catalog_id, 'caja_admin'));
create policy "receipts: miembro lee" on public.receipts
  for select to authenticated using (public.is_catalog_member(catalog_id));
create policy "receipt_lines: miembro lee" on public.receipt_lines
  for select to authenticated using (public.is_catalog_member(catalog_id));
create policy "cash_movements: propia o caja_admin" on public.cash_movements
  for select to authenticated
  using (
    public.tiene_permiso(catalog_id, 'caja_admin')
    or exists (select 1 from public.cash_sessions s
               where s.id = session_id and s.user_id = auth.uid())
  );

-- "Pago recibido" a mano: ahora solo con permiso (el resto, por caja)
drop policy if exists "customer_transactions: inserta" on public.customer_transactions;
create policy "customer_transactions: inserta" on public.customer_transactions
  for insert to authenticated
  with check (
    public.can_edit_catalog(catalog_id)
    and (
      kind = 'cargo'
      or public.tiene_permiso(catalog_id, 'cuenta_corriente_admin')
    )
  );

-- ------------------------------------------------------------
-- Triggers comunes
-- ------------------------------------------------------------
create trigger touch_cash_sessions before update on public.cash_sessions
  for each row execute function public.touch_updated_at();
create trigger touch_receipts before update on public.receipts
  for each row execute function public.touch_updated_at();

create or replace function public.fn_numerar_recibo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('receipts:' || new.catalog_id::text));
  select coalesce(max(number), 0) + 1 into new.number
    from public.receipts where catalog_id = new.catalog_id;
  return new;
end;
$$;

create trigger numerar_recibo before insert on public.receipts
  for each row execute function public.fn_numerar_recibo();

alter table public.audit_log drop constraint audit_log_entity_type_check;
alter table public.audit_log add constraint audit_log_entity_type_check
  check (entity_type in ('product', 'variant', 'price', 'stock', 'category', 'image',
                         'catalog', 'member', 'customer', 'supplier', 'product_supplier',
                         'promotion', 'customer_transaction', 'customer_price',
                         'order', 'order_item', 'channel_key',
                         'cash_session', 'receipt', 'cash_movement'));

create trigger audit_cash_sessions after insert or update or delete on public.cash_sessions
  for each row execute function public.fn_audit('cash_session');
create trigger audit_receipts after insert or update or delete on public.receipts
  for each row execute function public.fn_audit('receipt');
create trigger audit_cash_movements after insert or update or delete on public.cash_movements
  for each row execute function public.fn_audit('cash_movement');

-- ------------------------------------------------------------
-- Caja abierta del usuario en el catálogo (o error)
-- ------------------------------------------------------------
create or replace function public._caja_abierta(p_catalog uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.cash_sessions
    where catalog_id = p_catalog and user_id = auth.uid() and status = 'abierta';
  if v_id is null then
    raise exception 'Primero abrí tu caja (sección Caja)' using errcode = 'P0001';
  end if;
  return v_id;
end;
$$;

revoke execute on function public._caja_abierta(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- abrir_caja
-- ------------------------------------------------------------
create or replace function public.abrir_caja(p_catalog uuid, p_opening numeric)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not public.can_edit_catalog(p_catalog) then
    raise exception 'Sin permiso para usar la caja en este catálogo' using errcode = '42501';
  end if;
  if p_opening is null or p_opening < 0 then
    raise exception 'El efectivo inicial no puede ser negativo';
  end if;
  if exists (select 1 from public.cash_sessions
             where catalog_id = p_catalog and user_id = auth.uid() and status = 'abierta') then
    raise exception 'Ya tenés una caja abierta';
  end if;
  insert into public.cash_sessions (catalog_id, user_id, opening_amount)
    values (p_catalog, auth.uid(), round(p_opening, 2))
    returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.abrir_caja(uuid, numeric) to authenticated;
revoke execute on function public.abrir_caja(uuid, numeric) from anon;

-- ------------------------------------------------------------
-- _emitir_recibo (interna): valida las líneas y crea el recibo.
-- p_lines: [{method, amount, reference?}]
-- ------------------------------------------------------------
create or replace function public._emitir_recibo(
  p_catalog  uuid,
  p_customer uuid,
  p_order    uuid,
  p_lines    jsonb,
  p_note     text
)
returns public.receipts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session uuid := public._caja_abierta(p_catalog);
  v_line    jsonb;
  v_total   numeric := 0;
  v_amount  numeric;
  v_rec     public.receipts;
begin
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Indicá al menos un medio de pago';
  end if;
  if jsonb_array_length(p_lines) > 10 then
    raise exception 'Máximo 10 medios de pago por recibo';
  end if;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_amount := round((v_line->>'amount')::numeric, 2);
    if v_amount is null or v_amount <= 0 or v_amount > 999999999 then
      raise exception 'Importe inválido en el medio de pago';
    end if;
    if coalesce(v_line->>'method', '') not in
       ('efectivo', 'transferencia', 'mercado_pago', 'debito', 'credito') then
      raise exception 'Medio de pago inválido';
    end if;
    v_total := v_total + v_amount;
  end loop;

  insert into public.receipts (catalog_id, session_id, customer_id, order_id, total, note, created_by)
    values (p_catalog, v_session, p_customer, p_order, v_total,
            nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
    returning * into v_rec;

  insert into public.receipt_lines (catalog_id, receipt_id, method, amount, reference)
  select p_catalog, v_rec.id, l->>'method', round((l->>'amount')::numeric, 2),
         left(nullif(btrim(coalesce(l->>'reference', '')), ''), 100)
    from jsonb_array_elements(p_lines) l;

  return v_rec;
end;
$$;

revoke execute on function public._emitir_recibo(uuid, uuid, uuid, jsonb, text) from public, anon, authenticated;

-- ------------------------------------------------------------
-- registrar_cobro: cobro de cuenta corriente (cliente) o de un pedido
-- de contado pendiente (pedido). Devuelve el id del recibo.
-- ------------------------------------------------------------
create or replace function public.registrar_cobro(
  p_catalog  uuid,
  p_customer uuid,
  p_order    uuid,
  p_lines    jsonb,
  p_note     text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_rec   public.receipts;
begin
  if auth.uid() is null or not public.can_edit_catalog(p_catalog) then
    raise exception 'Sin permiso para cobrar en este catálogo' using errcode = '42501';
  end if;

  if p_order is not null then
    select * into v_order from public.orders
      where id = p_order and catalog_id = p_catalog for update;
    if not found then
      raise exception 'El pedido no existe';
    end if;
    if v_order.payment_terms <> 'contado' then
      raise exception 'Un pedido a cuenta corriente se cobra desde la cuenta del cliente';
    end if;
    if v_order.status in ('nuevo', 'cancelado') then
      raise exception 'Solo se cobra un pedido confirmado';
    end if;
    v_rec := public._emitir_recibo(p_catalog, v_order.customer_id, p_order, p_lines, p_note);
    if v_rec.total > v_order.total - v_order.paid_total then
      raise exception 'El cobro (%) supera lo que falta pagar del pedido (%)',
        v_rec.total, v_order.total - v_order.paid_total;
    end if;
    update public.orders set paid_total = paid_total + v_rec.total, updated_by = auth.uid()
      where id = p_order;
    return v_rec.id;
  end if;

  if p_customer is null then
    raise exception 'Elegí el cliente que paga';
  end if;
  if not exists (select 1 from public.customers
                 where id = p_customer and catalog_id = p_catalog and is_deleted = false) then
    raise exception 'El cliente no existe en este catálogo';
  end if;

  v_rec := public._emitir_recibo(p_catalog, p_customer, null, p_lines, p_note);
  insert into public.customer_transactions (
    catalog_id, customer_id, kind, amount, note, receipt_id, created_by, updated_by
  ) values (
    p_catalog, p_customer, 'pago', -v_rec.total, 'Recibo #' || v_rec.number,
    v_rec.id, auth.uid(), auth.uid()
  );
  return v_rec.id;
end;
$$;

grant execute on function public.registrar_cobro(uuid, uuid, uuid, jsonb, text) to authenticated;
revoke execute on function public.registrar_cobro(uuid, uuid, uuid, jsonb, text) from anon;

-- ------------------------------------------------------------
-- registrar_movimiento_caja: ingreso / egreso de efectivo con motivo
-- ------------------------------------------------------------
create or replace function public.registrar_movimiento_caja(
  p_catalog uuid,
  p_kind    text,
  p_amount  numeric,
  p_reason  text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session uuid;
begin
  if auth.uid() is null or not public.can_edit_catalog(p_catalog) then
    raise exception 'Sin permiso en este catálogo' using errcode = '42501';
  end if;
  v_session := public._caja_abierta(p_catalog);
  if p_kind not in ('ingreso', 'egreso') then
    raise exception 'Tipo de movimiento inválido';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El importe tiene que ser mayor a 0';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Escribí el motivo';
  end if;
  insert into public.cash_movements (catalog_id, session_id, kind, amount, reason, created_by)
    values (p_catalog, v_session, p_kind, round(p_amount, 2), btrim(p_reason), auth.uid());
end;
$$;

grant execute on function public.registrar_movimiento_caja(uuid, text, numeric, text) to authenticated;
revoke execute on function public.registrar_movimiento_caja(uuid, text, numeric, text) from anon;

-- ------------------------------------------------------------
-- efectivo_esperado: inicial + efectivo cobrado (recibos válidos) +
-- ingresos − egresos
-- ------------------------------------------------------------
create or replace function public.efectivo_esperado(p_session uuid)
returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  select s.opening_amount
       + coalesce((select sum(l.amount) from public.receipt_lines l
                   join public.receipts r on r.id = l.receipt_id
                   where r.session_id = s.id and r.status = 'valido' and l.method = 'efectivo'), 0)
       + coalesce((select sum(m.amount) from public.cash_movements m
                   where m.session_id = s.id and m.kind = 'ingreso'), 0)
       - coalesce((select sum(m.amount) from public.cash_movements m
                   where m.session_id = s.id and m.kind = 'egreso'), 0)
  from public.cash_sessions s where s.id = p_session;
$$;

grant execute on function public.efectivo_esperado(uuid) to authenticated;
revoke execute on function public.efectivo_esperado(uuid) from anon;

-- ------------------------------------------------------------
-- cerrar_caja: la propia, o cualquiera con caja_admin
-- ------------------------------------------------------------
create or replace function public.cerrar_caja(p_session uuid, p_counted numeric, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s        public.cash_sessions;
  v_esperado numeric;
begin
  select * into v_s from public.cash_sessions where id = p_session for update;
  if not found then
    raise exception 'La caja no existe';
  end if;
  if auth.uid() is null
     or not (v_s.user_id = auth.uid() or public.tiene_permiso(v_s.catalog_id, 'caja_admin')) then
    raise exception 'Sin permiso para cerrar esta caja' using errcode = '42501';
  end if;
  if v_s.status <> 'abierta' then
    raise exception 'La caja ya está cerrada';
  end if;
  if p_counted is null or p_counted < 0 then
    raise exception 'Indicá el efectivo contado';
  end if;
  v_esperado := public.efectivo_esperado(p_session);
  if round(p_counted, 2) <> v_esperado and length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'Hay diferencia con lo esperado: escribí una nota explicando el motivo';
  end if;
  update public.cash_sessions set
    status = 'cerrada', closed_at = now(), closed_by = auth.uid(),
    expected_cash = v_esperado, counted_cash = round(p_counted, 2),
    difference = round(p_counted, 2) - v_esperado,
    closing_note = nullif(btrim(coalesce(p_note, '')), '')
    where id = p_session;
end;
$$;

grant execute on function public.cerrar_caja(uuid, numeric, text) to authenticated;
revoke execute on function public.cerrar_caja(uuid, numeric, text) from anon;

-- ------------------------------------------------------------
-- anular_recibo: caja_admin; revierte el pago en cuenta corriente o lo
-- cobrado del pedido
-- ------------------------------------------------------------
create or replace function public.anular_recibo(p_receipt uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec public.receipts;
begin
  select * into v_rec from public.receipts where id = p_receipt for update;
  if not found then
    raise exception 'El recibo no existe';
  end if;
  if auth.uid() is null or not public.tiene_permiso(v_rec.catalog_id, 'caja_admin') then
    raise exception 'Anular un recibo requiere el permiso de caja' using errcode = '42501';
  end if;
  if v_rec.status = 'anulado' then
    raise exception 'El recibo ya está anulado';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Escribí el motivo de la anulación';
  end if;

  update public.customer_transactions set
    is_deleted = true, deleted_at = now(), deleted_by = auth.uid(), updated_by = auth.uid()
    where receipt_id = p_receipt and is_deleted = false;
  if v_rec.order_id is not null then
    update public.orders set paid_total = greatest(paid_total - v_rec.total, 0),
      updated_by = auth.uid()
      where id = v_rec.order_id;
  end if;
  update public.receipts set
    status = 'anulado', voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
    where id = p_receipt;
end;
$$;

grant execute on function public.anular_recibo(uuid, text) to authenticated;
revoke execute on function public.anular_recibo(uuid, text) from anon;

-- marca de envío por mail (la llama el servidor después de mandarlo)
create or replace function public.marcar_recibo_enviado(p_receipt uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.receipts set emailed_at = now()
    where id = p_receipt and public.is_catalog_member(catalog_id);
end;
$$;

grant execute on function public.marcar_recibo_enviado(uuid) to authenticated;
revoke execute on function public.marcar_recibo_enviado(uuid) from anon;

-- ------------------------------------------------------------
-- confirmar_pedido v2: si es de contado, cobra en el acto (p_pagos) o
-- queda "a cobrar al entregar" (p_cobrar_al_entregar).
-- Devuelve el id del recibo emitido (o null).
-- ------------------------------------------------------------
drop function if exists public.confirmar_pedido(uuid);

create or replace function public.confirmar_pedido(
  p_order              uuid,
  p_pagos              jsonb default null,
  p_cobrar_al_entregar boolean default false
)
returns uuid
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
  v_rec      public.receipts;
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

  -- contado: o se cobra ahora (total exacto) o queda a cobrar al entregar
  if v_order.payment_terms = 'contado' and v_order.total > 0 and not p_cobrar_al_entregar then
    if p_pagos is null or jsonb_typeof(p_pagos) <> 'array' or jsonb_array_length(p_pagos) = 0 then
      raise exception 'Indicá cómo paga (o marcá "cobrar al entregar")';
    end if;
    perform public._caja_abierta(v_order.catalog_id);
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

  -- stock suficiente
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
    collect_on_delivery = (payment_terms = 'contado' and p_cobrar_al_entregar),
    updated_by = auth.uid()
    where id = p_order;

  -- cobro en el acto (contado)
  if v_order.payment_terms = 'contado' and v_order.total > 0 and not p_cobrar_al_entregar then
    v_rec := public._emitir_recibo(v_order.catalog_id, v_order.customer_id, p_order, p_pagos, null);
    if v_rec.total <> v_order.total then
      raise exception 'Lo cobrado (%) no coincide con el total del pedido (%)',
        v_rec.total, v_order.total;
    end if;
    update public.orders set paid_total = v_rec.total where id = p_order;
    return v_rec.id;
  end if;
  return null;
end;
$$;

grant execute on function public.confirmar_pedido(uuid, jsonb, boolean) to authenticated;
revoke execute on function public.confirmar_pedido(uuid, jsonb, boolean) from anon;

-- ------------------------------------------------------------
-- avanzar_pedido v2: no se entrega un contado sin cobrar
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
  if p_status = 'entregado' and v_order.payment_terms = 'contado'
     and v_order.paid_total < v_order.total then
    raise exception 'Falta cobrar % de este pedido: registrá el cobro antes de marcarlo Entregado',
      v_order.total - v_order.paid_total;
  end if;

  update public.orders set
    status = p_status,
    delivered_at = case when p_status = 'entregado' then now() else delivered_at end,
    delivered_by = case when p_status = 'entregado' then auth.uid() else delivered_by end,
    updated_by = auth.uid()
    where id = p_order;
end;
$$;

-- ------------------------------------------------------------
-- cancelar_pedido v2: si el pedido tenía cobros, se anulan (admin)
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

    -- anular los cobros del pedido (el efectivo devuelto sale de la caja)
    update public.receipts set
      status = 'anulado', voided_at = now(), voided_by = auth.uid(),
      void_reason = 'Cancelación del pedido: ' || btrim(p_reason)
      where order_id = p_order and status = 'valido';
    update public.orders set paid_total = 0 where id = p_order;
  end if;

  update public.orders set
    status = 'cancelado', cancelled_at = now(), cancelled_by = auth.uid(),
    cancel_reason = btrim(p_reason), updated_by = auth.uid()
    where id = p_order;
end;
$$;
