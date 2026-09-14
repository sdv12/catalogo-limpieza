-- ============================================================
-- Bucket privado para los PDF de comprobantes fiscales (TusFacturasAPP).
-- La URL que devuelve la API es temporal (solo el día de la emisión), así
-- que se descarga y se guarda acá. Privado a propósito: sin policies para
-- `authenticated`/`anon`, solo el server (service_role, vía
-- lib/facturacion/tusfacturas.ts) puede leer/escribir — RLS de
-- storage.objects ya está habilitada por la migración del bucket de
-- imágenes de producto.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('comprobantes-fiscales', 'comprobantes-fiscales', false)
on conflict (id) do nothing;
