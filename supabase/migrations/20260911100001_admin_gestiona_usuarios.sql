-- ============================================================
-- El administrador de un catálogo pasa a poder gestionar los usuarios
-- de SU catálogo (antes era exclusivo del superadmin global, vía
-- /panel/catalogos). No toca is_superadmin ni otros catálogos: el rol
-- que puede asignar (admin/empleado/viewer) es siempre relativo a su
-- propio catalog_id.
-- ============================================================

create policy "members: admin del catalogo lee" on public.catalog_members
  for select to authenticated
  using (public.is_catalog_admin(catalog_id));

create policy "members: admin del catalogo inserta" on public.catalog_members
  for insert to authenticated
  with check (public.is_catalog_admin(catalog_id));

create policy "members: admin del catalogo edita" on public.catalog_members
  for update to authenticated
  using (public.is_catalog_admin(catalog_id))
  with check (public.is_catalog_admin(catalog_id));

create policy "members: admin del catalogo borra" on public.catalog_members
  for delete to authenticated
  using (public.is_catalog_admin(catalog_id));
