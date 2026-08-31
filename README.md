# Catálogo — Panel de administración

Panel de carga y gestión de productos para una distribuidora de artículos de
limpieza. Next.js (App Router) + Supabase (Postgres, Auth, Storage, RLS).

## Stack

- **Next.js 16** (App Router, TypeScript, Turbopack)
- **Supabase** — base de datos, autenticación (email + contraseña, sin registro
  público), Storage para imágenes, Row Level Security
- **Tailwind CSS v4** con tokens propios (`app/globals.css`)
- **Vitest** para tests unitarios

## Puesta en marcha

1. Crear un proyecto en [supabase.com](https://supabase.com).
2. Copiar credenciales a `.env.local` (ver `.env.local.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (solo servidor, tareas de sistema)
   - `SUPABASE_PROJECT_REF`
3. Vincular el CLI y aplicar migraciones (Etapa 1 en adelante):
   ```bash
   npx supabase login
   npx supabase link --project-ref <SUPABASE_PROJECT_REF>
   npm run db:push      # aplica supabase/migrations/*
   npm run db:types     # regenera types/database.ts
   ```
4. Crear el primer usuario administrador desde la consola de Supabase
   (Authentication → Users → Add user) y su fila en `profiles` con `role = 'admin'`.
5. Desarrollo:
   ```bash
   npm run dev
   ```

## Scripts

| Script            | Descripción                                  |
| ----------------- | -------------------------------------------- |
| `npm run dev`     | Servidor de desarrollo                       |
| `npm run build`   | Build de producción                          |
| `npm run lint`    | ESLint                                       |
| `npm run test`    | Tests (Vitest)                               |
| `npm run db:push` | Aplica migraciones al proyecto vinculado     |
| `npm run db:types`| Regenera los tipos TypeScript de la base     |

## Estructura

```
app/
  (auth)/login/               Ingreso
  api/plantilla-importacion/  Descarga de plantilla CSV/Excel
  panel/
    page.tsx                  Selector de catálogos
    catalogos/                CRUD de catálogos + usuarios (superadmin)
    [catalogo]/               Panel de un catálogo (por slug)
      page.tsx                Dashboard (métricas + últimos cambios)
      productos/              Listado, alta/edición, historial por producto
      categorias/             Árbol de categorías y subcategorías
      precios/                Niveles de precio + actualización en lote
      importar/               Carga masiva CSV / Excel (wizard con vista previa)
      actividad/              Auditoría global del catálogo (filtros)
        lote/[id]/            Detalle de una importación
components/                    ui · layout · products · categories · prices · audit · import
lib/
  supabase/                   Clientes (client / server / proxy / admin)
  dal.ts                      Sesión, perfil, resolución de catálogo por acceso
  guards.ts                   exigirEdicion() para Server Actions
  validation/, import/        Esquemas zod · parseo de planillas
supabase/migrations/          Esquema versionado
types/database.ts             Tipos generados de la base
proxy.ts                      Refresco de sesión + protección de rutas
```

## Flujo

`login` → **selector de catálogo** (Aura / Aromas, según acceso del usuario) →
panel del catálogo. Cada usuario tiene rol **editor** o **solo lectura** por catálogo
(`catalog_members`); el **superadmin** ve y administra todo.

## API pública (integración con landings / chatbot)

Endpoints de **solo lectura, sin autenticación**, que exponen únicamente
productos activos. Los sirve este mismo proyecto (funciones `storefront_*` en la
base, `SECURITY DEFINER`). CORS configurable con `PUBLIC_API_ALLOWED_ORIGINS`.

| Endpoint | Devuelve |
| --- | --- |
| `GET /api/publico/<catalogo>/meta` | nombre del catálogo, niveles de precio, árbol de categorías (con conteo de productos) |
| `GET /api/publico/<catalogo>/productos` | listado de productos activos. Query: `?q=`, `?categoria=<slug>`, `?limit=`, `?offset=` |
| `GET /api/publico/<catalogo>/productos?sku=<sku_base>` | un producto (detalle) |

`<catalogo>` es el slug (`aura`, `aromas`). Cada producto trae `presentaciones`
(cada una con `stock`, `disponible` y `precios` por nivel) e `imagenes` (URLs
públicas absolutas).

```js
// En la landing, reemplazar la fuente del catálogo:
const res = await fetch("https://<panel>.vercel.app/api/publico/aromas/productos");
const { productos } = await res.json();
```

Respuestas cacheadas en el edge (`s-maxage=120`). El carrito, checkout y usuarios
de cada landing siguen en su propio backend; este proyecto es la fuente del
**catálogo** (productos, precios, stock).

## Despliegue

### Panel (Vercel)

1. Subir el repo a GitHub/GitLab e importarlo en Vercel (framework Next.js, sin config extra).
2. Variables de entorno en Vercel (las de `.env.local.example`):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF`,
   `PUBLIC_API_ALLOWED_ORIGINS` (dominios de las landings, separados por coma).
3. Deploy. Las migraciones ya están aplicadas en el proyecto Supabase; para
   nuevas: `npm run db:push` desde local.

### Supabase

Nada extra: el proyecto es hosted. Verificar que el bucket `product-images`
siga **público** (Storage → Configuration).

## Auditoría

Todo cambio sobre productos, variantes, precios, stock y categorías queda
registrado en `audit_log` mediante triggers de Postgres `SECURITY DEFINER`, con
`actor_id = auth.uid()`, timestamp y diff (valor anterior → valor nuevo). Los
triggers rechazan cambios sin usuario autenticado: **no hay acciones anónimas
sobre el catálogo**.
