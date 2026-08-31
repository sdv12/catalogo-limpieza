-- ============================================================
-- Etapa 1 · 0001 — Identidad y control de acceso
-- Motor: PostgreSQL (Supabase)
-- ============================================================

create extension if not exists pg_trgm;

-- ------------------------------------------------------------
-- profiles — perfil de cada usuario administrador (1:1 auth.users)
-- ------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  full_name     text,
  is_superadmin boolean not null default false,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is
  'Perfil de cada usuario del panel. is_superadmin habilita el CRUD de catálogos y ver todos.';

-- Crea el perfil automáticamente al registrarse un usuario en auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mantiene profiles.email sincronizado con auth.users.email
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
    set email = new.email, updated_at = now()
    where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_updated
  after update of email on auth.users
  for each row execute function public.sync_profile_email();

-- ------------------------------------------------------------
-- catalogs — cada catálogo (tienda) administrado. Ej: Aura, Aromas
-- ------------------------------------------------------------
create table public.catalogs (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name        text not null,
  logo_path   text,
  is_active   boolean not null default true,
  attributes  jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

comment on table public.catalogs is 'Catálogos independientes. Todo el resto del modelo se scopea por catalog_id.';

-- ------------------------------------------------------------
-- catalog_members — acceso de un usuario a un catálogo + permiso
-- ------------------------------------------------------------
create table public.catalog_members (
  catalog_id  uuid not null references public.catalogs(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'editor' check (role in ('editor', 'viewer')),
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  primary key (catalog_id, user_id)
);

comment on table public.catalog_members is
  'editor = puede modificar el catálogo; viewer = solo lectura. El superadmin no necesita fila acá.';

create index catalog_members_user_idx on public.catalog_members (user_id);

-- ------------------------------------------------------------
-- Helpers de autorización (STABLE + SECURITY DEFINER para evitar
-- recursión de RLS al consultar profiles / catalog_members)
-- ------------------------------------------------------------
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_superadmin and p.is_active from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.is_catalog_member(cat uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_superadmin()
      or exists (
        select 1 from public.catalog_members m
        where m.catalog_id = cat and m.user_id = auth.uid()
      );
$$;

create or replace function public.can_edit_catalog(cat uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_superadmin()
      or exists (
        select 1 from public.catalog_members m
        where m.catalog_id = cat and m.user_id = auth.uid() and m.role = 'editor'
      );
$$;

-- Impide que un usuario común se auto-eleve a superadmin o se reactive
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.is_superadmin is distinct from old.is_superadmin
      or new.is_active is distinct from old.is_active)
     and not public.is_superadmin() then
    raise exception 'Solo un superadmin puede cambiar privilegios o el estado de una cuenta'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger protect_profile_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- ------------------------------------------------------------
-- updated_at genérico
-- ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_profiles before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger touch_catalogs before update on public.catalogs
  for each row execute function public.touch_updated_at();
