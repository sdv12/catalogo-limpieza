-- ============================================================
-- Módulos Clientes y Proveedores (por catálogo)
-- ============================================================

-- ------------------------------------------------------------
-- customers
-- ------------------------------------------------------------
create table public.customers (
  id            uuid primary key default gen_random_uuid(),
  catalog_id    uuid not null references public.catalogs(id) on delete cascade,
  name          text not null,
  doc_type      text check (doc_type in ('DNI', 'CUIT', 'CUIL', 'CDI', 'Pasaporte', 'Otro')),
  doc_number    text,
  tax_condition text not null default 'consumidor_final'
                check (tax_condition in ('responsable_inscripto', 'monotributo',
                                         'consumidor_final', 'exento', 'no_categorizado')),
  email         text,
  phone         text,
  address       text,
  city          text,
  province      text,
  price_tier_id uuid,
  credit_limit  numeric not null default 0 check (credit_limit >= 0),
  notes         text,
  is_active     boolean not null default true,
  is_deleted    boolean not null default false,
  deleted_at    timestamptz,
  deleted_by    uuid references auth.users(id),
  attributes    jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id),
  updated_by    uuid references auth.users(id),
  unique (id, catalog_id),
  foreign key (price_tier_id, catalog_id)
    references public.price_tiers (id, catalog_id) on delete set null
);

comment on table public.customers is 'Clientes del catálogo. Baja lógica (is_deleted).';

create index customers_catalog_idx on public.customers (catalog_id);
create index customers_name_trgm on public.customers using gin (name gin_trgm_ops);
create unique index customers_doc_unq on public.customers (catalog_id, doc_type, doc_number)
  where doc_number is not null and is_deleted = false;

create trigger touch_customers before update on public.customers
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- suppliers
-- ------------------------------------------------------------
create table public.suppliers (
  id            uuid primary key default gen_random_uuid(),
  catalog_id    uuid not null references public.catalogs(id) on delete cascade,
  name          text not null,
  doc_type      text check (doc_type in ('CUIT', 'CUIL', 'DNI', 'Otro')),
  doc_number    text,
  contact_name  text,
  email         text,
  phone         text,
  address       text,
  city          text,
  province      text,
  payment_terms text,
  notes         text,
  is_active     boolean not null default true,
  is_deleted    boolean not null default false,
  deleted_at    timestamptz,
  deleted_by    uuid references auth.users(id),
  attributes    jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id),
  updated_by    uuid references auth.users(id),
  unique (id, catalog_id)
);

comment on table public.suppliers is 'Proveedores del catálogo. Baja lógica (is_deleted).';

create index suppliers_catalog_idx on public.suppliers (catalog_id);
create index suppliers_name_trgm on public.suppliers using gin (name gin_trgm_ops);
create unique index suppliers_doc_unq on public.suppliers (catalog_id, doc_type, doc_number)
  where doc_number is not null and is_deleted = false;

create trigger touch_suppliers before update on public.suppliers
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- product_suppliers — qué proveedor provee qué producto (con su costo)
-- ------------------------------------------------------------
create table public.product_suppliers (
  product_id     uuid not null,
  supplier_id    uuid not null,
  catalog_id     uuid not null references public.catalogs(id) on delete cascade,
  supplier_sku   text,
  cost           numeric check (cost is null or cost >= 0),
  lead_time_days integer check (lead_time_days is null or lead_time_days >= 0),
  is_primary     boolean not null default false,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (product_id, supplier_id),
  foreign key (product_id, catalog_id)
    references public.products (id, catalog_id) on delete cascade,
  foreign key (supplier_id, catalog_id)
    references public.suppliers (id, catalog_id) on delete cascade
);

create index product_suppliers_supplier_idx on public.product_suppliers (supplier_id);
create index product_suppliers_catalog_idx on public.product_suppliers (catalog_id);
create unique index product_suppliers_primary_unq on public.product_suppliers (product_id)
  where is_primary;

create trigger touch_product_suppliers before update on public.product_suppliers
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['customers', 'suppliers', 'product_suppliers'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format($f$
      create policy "%1$s: miembro lee" on public.%1$I
        for select to authenticated using (public.is_catalog_member(catalog_id));
    $f$, t);
    execute format($f$
      create policy "%1$s: editor inserta" on public.%1$I
        for insert to authenticated with check (public.can_edit_catalog(catalog_id));
    $f$, t);
    execute format($f$
      create policy "%1$s: editor edita" on public.%1$I
        for update to authenticated
        using (public.can_edit_catalog(catalog_id))
        with check (public.can_edit_catalog(catalog_id));
    $f$, t);
    execute format($f$
      create policy "%1$s: editor borra" on public.%1$I
        for delete to authenticated using (public.can_edit_catalog(catalog_id));
    $f$, t);
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- Auditoría
-- ------------------------------------------------------------
alter table public.audit_log drop constraint audit_log_entity_type_check;
alter table public.audit_log add constraint audit_log_entity_type_check
  check (entity_type in ('product', 'variant', 'price', 'stock', 'category', 'image',
                         'catalog', 'member', 'customer', 'supplier'));

create trigger audit_customers after insert or update or delete on public.customers
  for each row execute function public.fn_audit('customer');
create trigger audit_suppliers after insert or update or delete on public.suppliers
  for each row execute function public.fn_audit('supplier');
