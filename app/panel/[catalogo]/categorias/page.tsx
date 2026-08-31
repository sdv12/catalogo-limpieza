import { resolverCatalogo, puedeEditar } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { CategoryManager } from "@/components/categories/CategoryManager";

export const metadata = { title: "Categorías — Catálogo" };

export type CategoriaNodo = {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  productos: number;
  hijos: CategoriaNodo[];
};

export default async function CategoriasPage({
  params,
}: {
  params: Promise<{ catalogo: string }>;
}) {
  const { catalogo: slug } = await params;
  const catalogo = await resolverCatalogo(slug);
  const supabase = await createClient();

  const [{ data: cats }, { data: prods }] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, parent_id, sort_order, is_active")
      .eq("catalog_id", catalogo.id)
      .order("sort_order"),
    supabase
      .from("products")
      .select("primary_category_id")
      .eq("catalog_id", catalogo.id)
      .eq("is_deleted", false),
  ]);

  const conteo = new Map<string, number>();
  for (const p of prods ?? []) {
    conteo.set(
      p.primary_category_id,
      (conteo.get(p.primary_category_id) ?? 0) + 1,
    );
  }

  const nodos = new Map<string, CategoriaNodo>();
  for (const c of cats ?? []) {
    nodos.set(c.id, {
      ...c,
      productos: conteo.get(c.id) ?? 0,
      hijos: [],
    });
  }
  const raiz: CategoriaNodo[] = [];
  for (const nodo of nodos.values()) {
    if (nodo.parent_id && nodos.has(nodo.parent_id)) {
      nodos.get(nodo.parent_id)!.hijos.push(nodo);
    } else {
      raiz.push(nodo);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-texto">Categorías</h1>
        <p className="mt-1 text-sm text-texto-sec">
          Organizá el catálogo en categorías y subcategorías.
        </p>
      </div>

      <CategoryManager
        slug={slug}
        raiz={raiz}
        soloLectura={!puedeEditar(catalogo)}
      />
    </div>
  );
}
