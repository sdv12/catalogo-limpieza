-- ============================================================
-- Promociones / ofertas del catálogo
--
--  · slide      → producto en el carrusel de la home (con título opcional)
--  · destacado  → producto en la sección "Destacados"
--  · oferta     → producto en promoción, con descuento % o monto
--
-- Cada una tiene orden (position, 1 = primero), activar/desactivar y
-- vigencia opcional (starts_at / ends_at). El "estar vigente" se resuelve
-- al leer (no hay tarea programada).
-- ============================================================

create table public.promotions (
  id             uuid primary key default gen_random_uuid(),
  catalog_id     uuid not null references public.catalogs(id) on delete cascade,
  kind           text not null check (kind in ('slide', 'destacado', 'oferta')),
  product_id     uuid not null,
  title          text,
  subtitle       text,
  link           text,
  discount_type  text check (discount_type in ('percent', 'amount')),
  discount_value numeric check (discount_value is null or discount_value >= 0),
  position       integer not null default 1,
  is_active      boolean not null default true,
  starts_at      timestamptz,
  ends_at        timestamptz,
  attributes     jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references auth.users(id),
  updated_by     uuid references auth.users(id),
  foreign key (product_id, catalog_id)
    references public.products (id, catalog_id) on delete cascade,
  check (ends_at is null or starts_at is null or ends_at >= starts_at),
  check (kind <> 'oferta' or (discount_type is not null and discount_value is not null))
);

comment on table public.promotions is
  'Promos del catálogo (slide / destacado / oferta). Orden por position; vigencia por fechas.';

create index promotions_catalog_idx on public.promotions (catalog_id, kind, position);
create index promotions_product_idx on public.promotions (product_id);

create trigger touch_promotions before update on public.promotions
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- RLS: miembro lee, administrador escribe
-- ------------------------------------------------------------
alter table public.promotions enable row level security;

create policy "promotions: miembro lee" on public.promotions
  for select to authenticated using (public.is_catalog_member(catalog_id));
create policy "promotions: admin inserta" on public.promotions
  for insert to authenticated with check (public.is_catalog_admin(catalog_id));
create policy "promotions: admin edita" on public.promotions
  for update to authenticated
  using (public.is_catalog_admin(catalog_id))
  with check (public.is_catalog_admin(catalog_id));
create policy "promotions: admin borra" on public.promotions
  for delete to authenticated using (public.is_catalog_admin(catalog_id));

-- ------------------------------------------------------------
-- Auditoría
-- ------------------------------------------------------------
alter table public.audit_log drop constraint audit_log_entity_type_check;
alter table public.audit_log add constraint audit_log_entity_type_check
  check (entity_type in ('product', 'variant', 'price', 'stock', 'category', 'image',
                         'catalog', 'member', 'customer', 'supplier', 'product_supplier',
                         'promotion'));

create trigger audit_promotions after insert or update or delete on public.promotions
  for each row execute function public.fn_audit('promotion');

-- ------------------------------------------------------------
-- storefront_promos — promos vigentes para la landing / API pública
-- ------------------------------------------------------------
create or replace function public.storefront_promos(p_catalog_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with c as (
    select id from public.catalogs where slug = p_catalog_slug and is_active
  )
  select coalesce(jsonb_agg(x order by x_kind, x_pos), '[]'::jsonb)
  from (
    select
      pr.kind as x_kind,
      pr.position as x_pos,
      jsonb_build_object(
        'tipo', pr.kind,
        'orden', pr.position,
        'titulo', coalesce(pr.title, p.name),
        'subtitulo', pr.subtitle,
        'link', coalesce(pr.link, '/producto/' || coalesce(p.base_sku, p.id::text)),
        'descuento', case when pr.discount_type is not null
          then jsonb_build_object('tipo', pr.discount_type, 'valor', pr.discount_value)
          else null end,
        'producto', jsonb_build_object(
          'sku', p.base_sku,
          'nombre', p.name,
          'marca', p.brand,
          'imagen', (select i.storage_path from public.product_images i
                     where i.product_id = p.id
                     order by i.is_primary desc, i.position asc limit 1)
        )
      ) as x
    from public.promotions pr
    join c on c.id = pr.catalog_id
    join public.products p
      on p.id = pr.product_id and p.is_deleted = false and p.status = 'active'
    where pr.is_active
      and (pr.starts_at is null or now() >= pr.starts_at)
      and (pr.ends_at is null or now() <= pr.ends_at)
  ) s;
$$;

revoke all on function public.storefront_promos(text) from public;
grant execute on function public.storefront_promos(text) to anon, authenticated, service_role;
