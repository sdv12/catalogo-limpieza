-- ============================================================
-- Costo por presentación (opcional). Base para calcular precios
-- por margen de ganancia en el formulario de producto.
-- No se expone en la API pública.
-- ============================================================
alter table public.product_variants
  add column if not exists cost numeric check (cost is null or cost >= 0);

comment on column public.product_variants.cost is
  'Costo de la presentación. Interno: NO se expone en storefront_*.';
