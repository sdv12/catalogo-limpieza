-- ============================================================
-- Fix: las policies de price_tiers llamaban a is_catalog_admin()
-- directo (no a can_manage_prices()), así que el permiso 'precios_lote'
-- no las alcanzaba. Detectado probando la migración anterior en vivo.
-- ============================================================
drop policy if exists "price_tiers: admin inserta" on public.price_tiers;
drop policy if exists "price_tiers: admin edita" on public.price_tiers;
drop policy if exists "price_tiers: admin borra" on public.price_tiers;

create policy "price_tiers: permiso inserta" on public.price_tiers
  for insert to authenticated with check (public.can_manage_prices(catalog_id));
create policy "price_tiers: permiso edita" on public.price_tiers
  for update to authenticated
  using (public.can_manage_prices(catalog_id))
  with check (public.can_manage_prices(catalog_id));
create policy "price_tiers: permiso borra" on public.price_tiers
  for delete to authenticated using (public.can_manage_prices(catalog_id));
