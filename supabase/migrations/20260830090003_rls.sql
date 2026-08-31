-- ============================================================
-- Etapa 1 · 0003 — Row Level Security
-- Regla general: solo usuarios autenticados; acceso scopeado por
-- pertenencia al catálogo (is_catalog_member) y edición para
-- editores/superadmin (can_edit_catalog).
-- ============================================================

-- ------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles: leer" on public.profiles
  for select to authenticated using (true);

create policy "profiles: editar propio" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "profiles: superadmin gestiona" on public.profiles
  for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- ------------------------------------------------------------
-- catalogs
-- ------------------------------------------------------------
alter table public.catalogs enable row level security;

create policy "catalogs: miembro lee" on public.catalogs
  for select to authenticated using (public.is_catalog_member(id));

create policy "catalogs: superadmin crea" on public.catalogs
  for insert to authenticated with check (public.is_superadmin());

create policy "catalogs: superadmin edita" on public.catalogs
  for update to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

create policy "catalogs: superadmin borra" on public.catalogs
  for delete to authenticated using (public.is_superadmin());

-- ------------------------------------------------------------
-- catalog_members
-- ------------------------------------------------------------
alter table public.catalog_members enable row level security;

create policy "members: ver propios o superadmin" on public.catalog_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_superadmin());

create policy "members: superadmin gestiona" on public.catalog_members
  for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

-- ------------------------------------------------------------
-- Tablas scopeadas por catálogo — mismo patrón para todas
-- ------------------------------------------------------------
do $$
declare
  t text;
  tablas text[] := array[
    'categories', 'price_tiers', 'products', 'product_categories',
    'product_variants', 'variant_prices', 'product_images',
    'stock_movements', 'import_batches'
  ];
begin
  foreach t in array tablas loop
    execute format('alter table public.%I enable row level security;', t);

    execute format($f$
      create policy "%1$s: miembro lee" on public.%1$I
        for select to authenticated
        using (public.is_catalog_member(catalog_id));
    $f$, t);

    execute format($f$
      create policy "%1$s: editor inserta" on public.%1$I
        for insert to authenticated
        with check (public.can_edit_catalog(catalog_id));
    $f$, t);

    execute format($f$
      create policy "%1$s: editor edita" on public.%1$I
        for update to authenticated
        using (public.can_edit_catalog(catalog_id))
        with check (public.can_edit_catalog(catalog_id));
    $f$, t);

    execute format($f$
      create policy "%1$s: editor borra" on public.%1$I
        for delete to authenticated
        using (public.can_edit_catalog(catalog_id));
    $f$, t);
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- audit_log — solo lectura para miembros; escritura solo por
-- los triggers SECURITY DEFINER (no hay policy de escritura).
-- ------------------------------------------------------------
alter table public.audit_log enable row level security;

create policy "audit: miembro lee" on public.audit_log
  for select to authenticated
  using (public.is_catalog_member(catalog_id));

revoke insert, update, delete on public.audit_log from anon, authenticated;

-- ------------------------------------------------------------
-- Storage: bucket product-images
--   lectura pública (bucket público) · escritura solo miembros
--   con permiso de edición del catálogo (carpeta = {catalog_id}/...)
-- ------------------------------------------------------------
create policy "product-images: lectura pública" on storage.objects
  for select to public
  using (bucket_id = 'product-images');

create policy "product-images: subir" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and public.can_edit_catalog(((storage.foldername(name))[1])::uuid)
  );

create policy "product-images: actualizar" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'product-images'
    and public.can_edit_catalog(((storage.foldername(name))[1])::uuid)
  );

create policy "product-images: borrar" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and public.can_edit_catalog(((storage.foldername(name))[1])::uuid)
  );
