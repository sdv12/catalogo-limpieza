-- ============================================================
-- Cuenta corriente de clientes: ledger de cargos/pagos, saldo y
-- próximo vencimiento cacheados en customers, vendedor asignado,
-- y una tabla de notificaciones de deuda (la llena la tarea programada).
-- ============================================================

-- ------------------------------------------------------------
-- customers: vendedor asignado + saldo + próximo vencimiento
-- ------------------------------------------------------------
alter table public.customers
  add column if not exists assigned_seller uuid references auth.users(id),
  add column if not exists balance numeric not null default 0,
  add column if not exists next_due_date date;

create index if not exists customers_assigned_seller_idx
  on public.customers (assigned_seller);
create index if not exists customers_balance_idx
  on public.customers (catalog_id, balance) where balance > 0;

comment on column public.customers.assigned_seller is
  'Vendedor/empleado a cargo del cliente (auth.users). Debe ser miembro del catálogo.';
comment on column public.customers.balance is
  'Saldo de cuenta corriente cacheado = suma de customer_transactions.amount. Positivo = el cliente debe.';
comment on column public.customers.next_due_date is
  'Vencimiento más próximo entre los cargos pendientes, solo si balance > 0. Cacheado.';

-- ------------------------------------------------------------
-- customer_transactions — ledger manual (cargo/pago/nota/ajuste)
-- ------------------------------------------------------------
create table public.customer_transactions (
  id          uuid primary key default gen_random_uuid(),
  catalog_id  uuid not null references public.catalogs(id) on delete cascade,
  customer_id uuid not null,
  kind        text not null check (kind in ('cargo', 'pago', 'nota_credito', 'nota_debito', 'ajuste')),
  amount      numeric not null check (amount <> 0),
  due_date    date,
  note        text,
  is_deleted  boolean not null default false,
  deleted_at  timestamptz,
  deleted_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  updated_by  uuid references auth.users(id),
  foreign key (customer_id, catalog_id)
    references public.customers (id, catalog_id) on delete cascade,
  check (
    (kind in ('cargo', 'nota_debito') and amount > 0) or
    (kind in ('pago', 'nota_credito') and amount < 0) or
    (kind = 'ajuste')
  )
);

comment on table public.customer_transactions is
  'Movimientos de cuenta corriente. amount positivo aumenta la deuda, negativo la reduce.';

create index customer_transactions_customer_idx
  on public.customer_transactions (customer_id, created_at desc);
create index customer_transactions_due_idx
  on public.customer_transactions (catalog_id, due_date)
  where due_date is not null and is_deleted = false;

create trigger touch_customer_transactions before update on public.customer_transactions
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- Mantiene customers.balance / next_due_date al día
-- ------------------------------------------------------------
create or replace function public.fn_recalcular_cuenta_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid := coalesce(new.customer_id, old.customer_id);
  v_balance  numeric;
  v_next     date;
begin
  select coalesce(sum(amount), 0) into v_balance
    from public.customer_transactions
    where customer_id = v_customer and is_deleted = false;

  select min(due_date) into v_next
    from public.customer_transactions
    where customer_id = v_customer and is_deleted = false
      and kind in ('cargo', 'nota_debito')
      and due_date is not null and due_date >= current_date;

  update public.customers
    set balance = v_balance,
        next_due_date = case when v_balance > 0 then v_next else null end
    where id = v_customer;

  return null;
end;
$$;

create trigger recalcular_cuenta_cliente
  after insert or update or delete on public.customer_transactions
  for each row execute function public.fn_recalcular_cuenta_cliente();

-- ------------------------------------------------------------
-- RLS: miembro lee; alta = editor (admin/empleado); edición y borrado
-- (correcciones sobre el ledger) solo admin, igual que los precios.
-- ------------------------------------------------------------
alter table public.customer_transactions enable row level security;

create policy "customer_transactions: miembro lee" on public.customer_transactions
  for select to authenticated using (public.is_catalog_member(catalog_id));
create policy "customer_transactions: editor inserta" on public.customer_transactions
  for insert to authenticated with check (public.can_edit_catalog(catalog_id));
create policy "customer_transactions: admin edita" on public.customer_transactions
  for update to authenticated
  using (public.is_catalog_admin(catalog_id))
  with check (public.is_catalog_admin(catalog_id));
create policy "customer_transactions: admin borra" on public.customer_transactions
  for delete to authenticated using (public.is_catalog_admin(catalog_id));

-- ------------------------------------------------------------
-- Auditoría
-- ------------------------------------------------------------
alter table public.audit_log drop constraint audit_log_entity_type_check;
alter table public.audit_log add constraint audit_log_entity_type_check
  check (entity_type in ('product', 'variant', 'price', 'stock', 'category', 'image',
                         'catalog', 'member', 'customer', 'supplier', 'product_supplier',
                         'promotion', 'customer_transaction'));

create trigger audit_customer_transactions
  after insert or update or delete on public.customer_transactions
  for each row execute function public.fn_audit('customer_transaction');

-- ------------------------------------------------------------
-- debt_notifications — registro de avisos de vencimiento ya enviados
-- (la escribe la tarea programada con service_role; sin policy de
-- insert para authenticated a propósito).
-- ------------------------------------------------------------
create table public.debt_notifications (
  id          uuid primary key default gen_random_uuid(),
  catalog_id  uuid not null references public.catalogs(id) on delete cascade,
  customer_id uuid not null,
  due_date    date not null,
  sent_at     timestamptz not null default now(),
  recipients  jsonb not null default '[]'::jsonb,
  foreign key (customer_id, catalog_id)
    references public.customers (id, catalog_id) on delete cascade,
  unique (customer_id, due_date)
);

comment on table public.debt_notifications is
  'Un aviso por cliente y vencimiento (evita reenviar el mismo día). Lo escribe la tarea programada.';

alter table public.debt_notifications enable row level security;
create policy "debt_notifications: miembro lee" on public.debt_notifications
  for select to authenticated using (public.is_catalog_member(catalog_id));

-- ------------------------------------------------------------
-- por_cobrar — clientes con deuda cuyo próximo vencimiento cae en
-- los próximos p_dias_antes días (para el aviso) o ya venció
-- ------------------------------------------------------------
create or replace function public.customers_por_cobrar(
  p_catalog_id  uuid,
  p_dias_antes  integer default 4
)
returns table (
  customer_id     uuid,
  name            text,
  email           text,
  phone           text,
  balance         numeric,
  next_due_date   date,
  assigned_seller uuid
)
language sql
stable
security invoker
set search_path = public
as $$
  select c.id, c.name, c.email, c.phone, c.balance, c.next_due_date, c.assigned_seller
  from public.customers c
  where c.catalog_id = p_catalog_id
    and c.is_deleted = false
    and c.balance > 0
    and c.next_due_date is not null
    and c.next_due_date <= current_date + p_dias_antes
  order by c.next_due_date;
$$;

grant execute on function public.customers_por_cobrar(uuid, integer) to authenticated;
