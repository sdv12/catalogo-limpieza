-- ============================================================
-- Etapa 1 · 0002 — Modelo del catálogo
-- Todas las tablas llevan catalog_id (denormalizado) para RLS
-- y filtros simples. Las FK compuestas (col, catalog_id) impiden
-- referencias entre catálogos distintos.
-- ============================================================

-- ------------------------------------------------------------
-- categories — categorías y subcategorías
-- ------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  catalog_id  uuid not null references public.catalogs(id) on delete cascade,
  parent_id   uuid,
  name        text not null,
  slug        text not null,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  updated_by  uuid references auth.users(id),
  unique (id, catalog_id),
  unique (catalog_id, slug),
  foreign key (parent_id, catalog_id)
    references public.categories (id, catalog_id) on delete restrict
);

comment on table public.categories is 'Árbol de categorías por catálogo. parent_id null = categoría raíz.';

create index categories_catalog_idx on public.categories (catalog_id);
create index categories_parent_idx on public.categories (catalog_id, parent_id);
-- unicidad de nombre entre hermanas (tratando null como raíz)
create unique index categories_nombre_unq on public.categories
  (catalog_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

create trigger touch_categories before update on public.categories
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- price_tiers — niveles de precio por catálogo
-- ------------------------------------------------------------
create table public.price_tiers (
  id          uuid primary key default gen_random_uuid(),
  catalog_id  uuid not null references public.catalogs(id) on delete cascade,
  name        text not null,
  code        text not null check (code ~ '^[a-z0-9_]+$'),
  sort_order  integer not null default 0,
  is_default  boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, catalog_id),
  unique (catalog_id, code)
);

comment on table public.price_tiers is 'Ej: Minorista, Mayorista, Distribuidor. Cada catálogo define los suyos.';

create index price_tiers_catalog_idx on public.price_tiers (catalog_id);
create unique index price_tiers_default_unq on public.price_tiers (catalog_id) where is_default;

create trigger touch_price_tiers before update on public.price_tiers
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- import_batches — operaciones en lote (import / precios)
-- ------------------------------------------------------------
create table public.import_batches (
  id           uuid primary key default gen_random_uuid(),
  catalog_id   uuid not null references public.catalogs(id) on delete cascade,
  kind         text not null check (kind in ('product_import', 'price_bulk_update')),
  filename     text,
  status       text not null default 'previewed'
               check (status in ('previewed', 'completed', 'partial', 'failed')),
  total_rows   integer not null default 0,
  ok_rows      integer not null default 0,
  error_rows   integer not null default 0,
  params       jsonb not null default '{}'::jsonb,
  report       jsonb not null default '[]'::jsonb,
  actor_id     uuid not null references auth.users(id),
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index import_batches_catalog_idx on public.import_batches (catalog_id, created_at desc);

-- ------------------------------------------------------------
-- products — producto "padre"
-- ------------------------------------------------------------
create table public.products (
  id                  uuid primary key default gen_random_uuid(),
  catalog_id          uuid not null references public.catalogs(id) on delete cascade,
  name                text not null,
  description         text,
  brand               text,
  base_sku            text,
  primary_category_id uuid not null,
  status              text not null default 'active' check (status in ('active', 'inactive')),
  is_deleted          boolean not null default false,
  deleted_at          timestamptz,
  deleted_by          uuid references auth.users(id),
  attributes          jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id),
  updated_by          uuid references auth.users(id),
  unique (id, catalog_id),
  unique (catalog_id, base_sku),
  foreign key (primary_category_id, catalog_id)
    references public.categories (id, catalog_id) on delete restrict
);

comment on table public.products is 'Producto del catálogo. El precio y el stock viven en product_variants.';

create index products_catalog_idx on public.products (catalog_id);
create index products_estado_idx on public.products (catalog_id, status) where is_deleted = false;
create index products_categoria_idx on public.products (primary_category_id);
create index products_name_trgm on public.products using gin (name gin_trgm_ops);
create index products_sku_trgm on public.products using gin (base_sku gin_trgm_ops);

create trigger touch_products before update on public.products
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- product_categories — categorías adicionales (M:N).
-- La primaria se refleja acá con is_primary = true vía trigger.
-- ------------------------------------------------------------
create table public.product_categories (
  product_id  uuid not null,
  category_id uuid not null,
  catalog_id  uuid not null references public.catalogs(id) on delete cascade,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (product_id, category_id),
  foreign key (product_id, catalog_id)
    references public.products (id, catalog_id) on delete cascade,
  foreign key (category_id, catalog_id)
    references public.categories (id, catalog_id) on delete restrict
);

create index product_categories_categoria_idx on public.product_categories (category_id);

-- Sincroniza la categoría primaria del producto en product_categories
create or replace function public.sync_primary_category()
returns trigger
language plpgsql
as $$
begin
  insert into public.product_categories (product_id, category_id, catalog_id, is_primary)
  values (new.id, new.primary_category_id, new.catalog_id, true)
  on conflict (product_id, category_id) do update set is_primary = true;

  update public.product_categories
    set is_primary = false
    where product_id = new.id and category_id <> new.primary_category_id;

  return new;
end;
$$;

create trigger sync_primary_category
  after insert or update of primary_category_id on public.products
  for each row execute function public.sync_primary_category();

-- ------------------------------------------------------------
-- product_variants — presentaciones (500 ml, 1 L, bidón 20 L…)
-- ------------------------------------------------------------
create table public.product_variants (
  id          uuid primary key default gen_random_uuid(),
  catalog_id  uuid not null references public.catalogs(id) on delete cascade,
  product_id  uuid not null,
  name        text not null,
  sku         text not null,
  size_value  numeric,
  size_unit   text check (size_unit in ('ml', 'l', 'g', 'kg', 'u')),
  barcode     text,
  stock       numeric not null default 0,
  min_stock   numeric not null default 0 check (min_stock >= 0),
  is_active   boolean not null default true,
  is_deleted  boolean not null default false,
  position    integer not null default 0,
  attributes  jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  updated_by  uuid references auth.users(id),
  unique (id, catalog_id),
  unique (catalog_id, sku),
  foreign key (product_id, catalog_id)
    references public.products (id, catalog_id) on delete cascade
);

create index product_variants_catalog_idx on public.product_variants (catalog_id);
create index product_variants_product_idx on public.product_variants (product_id);
create index product_variants_sku_trgm on public.product_variants using gin (sku gin_trgm_ops);
create index product_variants_stock_bajo_idx on public.product_variants (catalog_id)
  where is_deleted = false and stock < min_stock;

create trigger touch_product_variants before update on public.product_variants
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- variant_prices — precio de una variante en un nivel
-- ------------------------------------------------------------
create table public.variant_prices (
  id            uuid primary key default gen_random_uuid(),
  catalog_id    uuid not null references public.catalogs(id) on delete cascade,
  variant_id    uuid not null,
  price_tier_id uuid not null,
  price         numeric(12, 2) not null check (price >= 0),
  currency      text not null default 'ARS',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id),
  unique (variant_id, price_tier_id),
  foreign key (variant_id, catalog_id)
    references public.product_variants (id, catalog_id) on delete cascade,
  foreign key (price_tier_id, catalog_id)
    references public.price_tiers (id, catalog_id) on delete restrict
);

create index variant_prices_catalog_idx on public.variant_prices (catalog_id);
create index variant_prices_variant_idx on public.variant_prices (variant_id);

create trigger touch_variant_prices before update on public.variant_prices
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- product_images — imágenes (nivel producto o variante)
-- ------------------------------------------------------------
create table public.product_images (
  id           uuid primary key default gen_random_uuid(),
  catalog_id   uuid not null references public.catalogs(id) on delete cascade,
  product_id   uuid not null,
  variant_id   uuid,
  storage_path text not null,
  alt          text,
  position     integer not null default 0,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id),
  foreign key (product_id, catalog_id)
    references public.products (id, catalog_id) on delete cascade,
  foreign key (variant_id, catalog_id)
    references public.product_variants (id, catalog_id) on delete set null
);

create index product_images_product_idx on public.product_images (product_id);
create unique index product_images_primary_unq on public.product_images (product_id) where is_primary;

-- ------------------------------------------------------------
-- stock_movements — ledger de ajustes de stock (con motivo)
-- ------------------------------------------------------------
create table public.stock_movements (
  id             uuid primary key default gen_random_uuid(),
  catalog_id     uuid not null references public.catalogs(id) on delete cascade,
  variant_id     uuid not null,
  delta          numeric not null,
  reason         text not null
                 check (reason in ('ingreso', 'venta', 'merma', 'ajuste', 'conteo', 'importacion')),
  note           text,
  previous_stock numeric not null,
  new_stock      numeric not null,
  batch_id       uuid references public.import_batches(id) on delete set null,
  created_at     timestamptz not null default now(),
  created_by     uuid not null references auth.users(id),
  foreign key (variant_id, catalog_id)
    references public.product_variants (id, catalog_id) on delete cascade
);

create index stock_movements_variant_idx on public.stock_movements (variant_id, created_at desc);
create index stock_movements_catalog_idx on public.stock_movements (catalog_id, created_at desc);

-- ------------------------------------------------------------
-- audit_log — registro central de cambios (inmutable)
-- ------------------------------------------------------------
create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  catalog_id  uuid not null references public.catalogs(id) on delete cascade,
  entity_type text not null
              check (entity_type in ('product', 'variant', 'price', 'stock',
                                     'category', 'image', 'catalog', 'member')),
  entity_id   uuid not null,
  product_id  uuid,
  action      text not null
              check (action in ('create', 'update', 'delete', 'restore', 'duplicate',
                                'stock_adjust', 'price_adjust', 'bulk_import', 'bulk_price_update')),
  changes     jsonb not null default '[]'::jsonb,
  summary     text,
  batch_id    uuid references public.import_batches(id) on delete set null,
  actor_id    uuid not null references auth.users(id),
  actor_email text,
  created_at  timestamptz not null default now()
);

comment on table public.audit_log is
  'Cada cambio sobre el catálogo. Se llena solo por triggers SECURITY DEFINER; los usuarios no pueden escribir acá.';

create index audit_log_catalog_idx on public.audit_log (catalog_id, created_at desc);
create index audit_log_product_idx on public.audit_log (product_id, created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id, created_at desc);
create index audit_log_accion_idx on public.audit_log (catalog_id, action, created_at desc);
create index audit_log_batch_idx on public.audit_log (batch_id);

-- ------------------------------------------------------------
-- Storage — bucket de imágenes de productos
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;
