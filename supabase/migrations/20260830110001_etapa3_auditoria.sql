-- ============================================================
-- Etapa 3 · auditoría (UI)
--  · catalog_actors  usuarios distintos que hicieron cambios en el catálogo
--    (para el filtro "por usuario" de la actividad)
-- ============================================================

create or replace function public.catalog_actors(p_catalog_id uuid)
returns table (actor_id uuid, actor_email text)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct a.actor_id, a.actor_email
  from public.audit_log a
  where a.catalog_id = p_catalog_id
    and public.is_catalog_member(p_catalog_id)
  order by a.actor_email;
$$;

grant execute on function public.catalog_actors(uuid) to authenticated;
