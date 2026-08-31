-- ============================================================
-- Etapa 1 · 0008 — Ajuste de protect_profile_privileges
-- El trigger solo debe frenar a un USUARIO autenticado que no sea
-- superadmin intentando auto-elevarse. Las operaciones de backend
-- (service_role / SQL, auth.uid() null) quedan permitidas: ya
-- requieren credenciales privilegiadas.
-- ============================================================

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.is_superadmin is distinct from old.is_superadmin
      or new.is_active is distinct from old.is_active)
     and auth.uid() is not null
     and not public.is_superadmin() then
    raise exception 'Solo un superadmin puede cambiar privilegios o el estado de una cuenta'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
