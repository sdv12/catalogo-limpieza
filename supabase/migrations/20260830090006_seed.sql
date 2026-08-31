-- ============================================================
-- Etapa 1 · 0006 — Datos iniciales
--  · catálogos Aura y Aromas
--  · niveles de precio de cada catálogo
--  · categorías de ejemplo
--
-- session_replication_role = replica desactiva los triggers
-- (incluida la auditoría, que rechaza inserts sin usuario) mientras
-- se cargan los datos de sistema. Se restaura al final.
-- ============================================================

set session_replication_role = replica;

-- Catálogos
insert into public.catalogs (slug, name) values
  ('aura',   'Catálogo Aura'),
  ('aromas', 'Catálogo Aromas')
on conflict (slug) do nothing;

-- Niveles de precio (los mismos 3 para cada catálogo, editables luego)
insert into public.price_tiers (catalog_id, name, code, sort_order, is_default)
select c.id, t.name, t.code, t.ord, t.def
from public.catalogs c
cross join (values
  ('Minorista',    'minorista',    1, true),
  ('Mayorista',    'mayorista',    2, false),
  ('Distribuidor', 'distribuidor', 3, false)
) as t(name, code, ord, def)
where c.slug in ('aura', 'aromas')
on conflict (catalog_id, code) do nothing;

-- Categorías raíz de ejemplo
insert into public.categories (catalog_id, name, slug, sort_order)
select c.id, x.name, x.slug, x.ord
from public.catalogs c
cross join (values
  ('Limpieza de pisos',  'limpieza-de-pisos',  1),
  ('Limpieza de baño',   'limpieza-de-bano',   2),
  ('Cocina',             'cocina',             3),
  ('Lavandería',         'lavanderia',         4),
  ('Desinfectantes',     'desinfectantes',     5),
  ('Higiene personal',   'higiene-personal',   6),
  ('Accesorios',         'accesorios',         7)
) as x(name, slug, ord)
where c.slug in ('aura', 'aromas')
on conflict (catalog_id, slug) do nothing;

set session_replication_role = default;
