-- ============================================================
-- Etapa 1 · 0007 — Ajuste de permisos
-- catalog_view / search_catalog quedan disponibles para usuarios
-- autenticados y para el backend (service_role). El acceso anónimo
-- se habilitará explícitamente si en el futuro un chatbot lo necesita.
-- ============================================================

grant select on public.catalog_view to service_role;

revoke execute on function public.search_catalog(text, text, text, integer) from public;
grant execute on function public.search_catalog(text, text, text, integer) to authenticated, service_role;

grant execute on function public.category_path(uuid) to service_role;
