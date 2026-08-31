"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirEdicion, type ResultadoAccion } from "@/lib/guards";
import { BUCKET_IMAGENES, type MotivoStock } from "@/lib/constants";
import {
  productoSchema,
  validarPreciosMinimos,
  preciosValidos,
  generarSkuVariante,
  type ProductoInput,
  type VarianteInput,
} from "@/lib/validation/product";

/** SKU de la variante: el que puso el usuario o uno generado si lo dejó vacío. */
function skuDeVariante(v: VarianteInput, dato: ProductoInput): string {
  return v.sku && v.sku.trim()
    ? v.sku.trim()
    : generarSkuVariante(dato.base_sku, dato.name, v.name);
}

function revalidar(slug: string, id?: string) {
  revalidatePath(`/panel/${slug}/productos`);
  revalidatePath(`/panel/${slug}`);
  if (id) revalidatePath(`/panel/${slug}/productos/${id}`);
}

// ------------------------------------------------------------
// Alta
// ------------------------------------------------------------
export async function crearProducto(
  slug: string,
  input: ProductoInput,
): Promise<ResultadoAccion> {
  const catalogo = await exigirEdicion(slug);
  const parsed = productoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const dato = parsed.data;
  const errPrecio = validarPreciosMinimos(dato);
  if (errPrecio) return { ok: false, message: errPrecio };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  const { data: prod, error: eProd } = await supabase
    .from("products")
    .insert({
      catalog_id: catalogo.id,
      name: dato.name,
      description: dato.description,
      brand: dato.brand,
      base_sku: dato.base_sku,
      primary_category_id: dato.primary_category_id,
      status: dato.status,
      created_by: uid,
      updated_by: uid,
    })
    .select("id")
    .single();

  if (eProd || !prod) {
    return {
      ok: false,
      message: /duplicate|unique/i.test(eProd?.message ?? "")
        ? "Ya existe un producto con ese código interno (SKU base)"
        : eProd?.message ?? "No se pudo crear el producto",
    };
  }

  const cleanup = async (msg: string) => {
    await supabase.from("products").delete().eq("id", prod.id);
    return { ok: false, message: msg };
  };

  // categorías extra
  const extra = dato.extra_category_ids.filter(
    (c) => c !== dato.primary_category_id,
  );
  if (extra.length) {
    const { error } = await supabase.from("product_categories").insert(
      extra.map((category_id) => ({
        product_id: prod.id,
        category_id,
        catalog_id: catalogo.id,
        is_primary: false,
      })),
    );
    if (error) return cleanup(error.message);
  }

  // variantes + precios
  for (const [i, v] of dato.variants.entries()) {
    const sku = skuDeVariante(v, dato);
    const { data: variante, error: eVar } = await supabase
      .from("product_variants")
      .insert({
        catalog_id: catalogo.id,
        product_id: prod.id,
        name: v.name,
        sku,
        size_value: v.size_value,
        size_unit: v.size_unit,
        barcode: v.barcode,
        cost: v.cost,
        stock: v.stock_inicial ?? 0,
        min_stock: v.min_stock ?? 0,
        position: i,
        created_by: uid,
        updated_by: uid,
      })
      .select("id")
      .single();

    if (eVar || !variante) {
      return cleanup(
        /duplicate|unique/i.test(eVar?.message ?? "")
          ? `El SKU "${sku}" ya existe en este catálogo`
          : eVar?.message ?? "No se pudieron crear las presentaciones",
      );
    }

    const precios = preciosValidos(v.prices);
    if (precios.length) {
      const { error } = await supabase.from("variant_prices").insert(
        precios.map((p) => ({
          catalog_id: catalogo.id,
          variant_id: variante.id,
          price_tier_id: p.tierId,
          price: p.price,
          updated_by: uid,
        })),
      );
      if (error) return cleanup(error.message);
    }
  }

  // imágenes
  if (dato.images.length) {
    const { error } = await supabase.from("product_images").insert(
      dato.images.map((img, idx) => ({
        catalog_id: catalogo.id,
        product_id: prod.id,
        storage_path: img.path,
        alt: img.alt ?? null,
        position: idx,
        is_primary: idx === 0,
        created_by: uid,
      })),
    );
    if (error) return cleanup(error.message);
  }

  revalidar(slug, prod.id);
  return { ok: true, message: "Producto creado", data: { id: prod.id } };
}

// ------------------------------------------------------------
// Edición
// ------------------------------------------------------------
export async function actualizarProducto(
  slug: string,
  productId: string,
  input: ProductoInput,
): Promise<ResultadoAccion> {
  const catalogo = await exigirEdicion(slug);
  const parsed = productoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const dato = parsed.data;
  const errPrecio = validarPreciosMinimos(dato);
  if (errPrecio) return { ok: false, message: errPrecio };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  const { error: eProd } = await supabase
    .from("products")
    .update({
      name: dato.name,
      description: dato.description,
      brand: dato.brand,
      base_sku: dato.base_sku,
      primary_category_id: dato.primary_category_id,
      status: dato.status,
      updated_by: uid,
    })
    .eq("id", productId)
    .eq("catalog_id", catalogo.id);
  if (eProd) {
    return {
      ok: false,
      message: /duplicate|unique/i.test(eProd.message)
        ? "Ya existe un producto con ese código interno (SKU base)"
        : eProd.message,
    };
  }

  // --- categorías extra: reconciliar
  const { data: catActuales } = await supabase
    .from("product_categories")
    .select("category_id, is_primary")
    .eq("product_id", productId);
  const extraActuales = new Set(
    (catActuales ?? []).filter((c) => !c.is_primary).map((c) => c.category_id),
  );
  const extraNuevas = new Set(
    dato.extra_category_ids.filter((c) => c !== dato.primary_category_id),
  );
  const quitar = [...extraActuales].filter((c) => !extraNuevas.has(c));
  const agregar = [...extraNuevas].filter((c) => !extraActuales.has(c));
  if (quitar.length) {
    await supabase
      .from("product_categories")
      .delete()
      .eq("product_id", productId)
      .in("category_id", quitar);
  }
  if (agregar.length) {
    await supabase.from("product_categories").insert(
      agregar.map((category_id) => ({
        product_id: productId,
        category_id,
        catalog_id: catalogo.id,
        is_primary: false,
      })),
    );
  }

  // --- variantes: reconciliar
  const { data: varActuales } = await supabase
    .from("product_variants")
    .select("id")
    .eq("product_id", productId)
    .eq("is_deleted", false);
  const idsActuales = new Set((varActuales ?? []).map((v) => v.id));
  const idsEnviados = new Set(
    dato.variants.map((v) => v.id).filter((x): x is string => !!x),
  );

  // eliminadas → soft delete
  for (const id of idsActuales) {
    if (!idsEnviados.has(id)) {
      await supabase
        .from("product_variants")
        .update({ is_deleted: true, updated_by: uid })
        .eq("id", id);
    }
  }

  for (const [i, v] of dato.variants.entries()) {
    let variantId = v.id;
    const sku = skuDeVariante(v, dato);
    if (variantId && idsActuales.has(variantId)) {
      const { error } = await supabase
        .from("product_variants")
        .update({
          name: v.name,
          sku,
          size_value: v.size_value,
          size_unit: v.size_unit,
          barcode: v.barcode,
          cost: v.cost,
          min_stock: v.min_stock ?? 0,
          position: i,
          updated_by: uid,
        })
        .eq("id", variantId);
      if (error) {
        return {
          ok: false,
          message: /duplicate|unique/i.test(error.message)
            ? `El SKU "${sku}" ya existe en este catálogo`
            : error.message,
        };
      }
    } else {
      const { data: creada, error } = await supabase
        .from("product_variants")
        .insert({
          catalog_id: catalogo.id,
          product_id: productId,
          name: v.name,
          sku,
          size_value: v.size_value,
          size_unit: v.size_unit,
          barcode: v.barcode,
          cost: v.cost,
          stock: v.stock_inicial ?? 0,
          min_stock: v.min_stock ?? 0,
          position: i,
          created_by: uid,
          updated_by: uid,
        })
        .select("id")
        .single();
      if (error || !creada) {
        return {
          ok: false,
          message: /duplicate|unique/i.test(error?.message ?? "")
            ? `El SKU "${sku}" ya existe en este catálogo`
            : error?.message ?? "No se pudo agregar la presentación",
        };
      }
      variantId = creada.id;
    }

    // precios de la variante: reconciliar
    const deseados = preciosValidos(v.prices);
    const deseadosMap = new Map(deseados.map((p) => [p.tierId, p.price]));
    const { data: preciosActuales } = await supabase
      .from("variant_prices")
      .select("id, price_tier_id, price")
      .eq("variant_id", variantId);

    for (const pa of preciosActuales ?? []) {
      if (!deseadosMap.has(pa.price_tier_id)) {
        await supabase.from("variant_prices").delete().eq("id", pa.id);
      } else if (Number(deseadosMap.get(pa.price_tier_id)) !== Number(pa.price)) {
        await supabase
          .from("variant_prices")
          .update({ price: deseadosMap.get(pa.price_tier_id), updated_by: uid })
          .eq("id", pa.id);
      }
      deseadosMap.delete(pa.price_tier_id);
    }
    if (deseadosMap.size) {
      await supabase.from("variant_prices").insert(
        [...deseadosMap.entries()].map(([price_tier_id, price]) => ({
          catalog_id: catalogo.id,
          variant_id: variantId!,
          price_tier_id,
          price,
          updated_by: uid,
        })),
      );
    }
  }

  // --- imágenes: reconciliar
  const { data: imgActuales } = await supabase
    .from("product_images")
    .select("id, storage_path")
    .eq("product_id", productId);
  const pathsEnviados = new Set(dato.images.map((i) => i.path));
  const aBorrar = (imgActuales ?? []).filter(
    (i) => !pathsEnviados.has(i.storage_path),
  );
  if (aBorrar.length) {
    await supabase
      .from("product_images")
      .delete()
      .in(
        "id",
        aBorrar.map((i) => i.id),
      );
    await supabase.storage
      .from(BUCKET_IMAGENES)
      .remove(aBorrar.map((i) => i.storage_path));
  }
  const pathsActuales = new Set((imgActuales ?? []).map((i) => i.storage_path));
  const nuevas = dato.images.filter((i) => !pathsActuales.has(i.path));
  if (nuevas.length) {
    const base = (imgActuales?.length ?? 0) - aBorrar.length;
    await supabase.from("product_images").insert(
      nuevas.map((img, idx) => ({
        catalog_id: catalogo.id,
        product_id: productId,
        storage_path: img.path,
        alt: img.alt ?? null,
        position: base + idx,
        is_primary: base + idx === 0,
        created_by: uid,
      })),
    );
  }

  revalidar(slug, productId);
  return { ok: true, message: "Producto actualizado", data: { id: productId } };
}

// ------------------------------------------------------------
// Baja / restauración / duplicado
// ------------------------------------------------------------
export async function eliminarProducto(
  slug: string,
  productId: string,
): Promise<ResultadoAccion> {
  const catalogo = await exigirEdicion(slug);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("products")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: user!.id,
    })
    .eq("id", productId)
    .eq("catalog_id", catalogo.id);
  if (error) return { ok: false, message: error.message };
  revalidar(slug, productId);
  return { ok: true, message: "Producto dado de baja" };
}

export async function restaurarProducto(
  slug: string,
  productId: string,
): Promise<ResultadoAccion> {
  const catalogo = await exigirEdicion(slug);
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ is_deleted: false, deleted_at: null, deleted_by: null })
    .eq("id", productId)
    .eq("catalog_id", catalogo.id);
  if (error) return { ok: false, message: error.message };
  revalidar(slug, productId);
  return { ok: true, message: "Producto reactivado" };
}

export async function duplicarProducto(
  slug: string,
  productId: string,
): Promise<ResultadoAccion> {
  await exigirEdicion(slug);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("duplicate_product", {
    p_product_id: productId,
  });
  if (error) return { ok: false, message: error.message };
  revalidar(slug);
  return { ok: true, message: "Producto duplicado", data: { id: data } };
}

// ------------------------------------------------------------
// Ajuste de stock
// ------------------------------------------------------------
export async function ajustarStock(
  slug: string,
  variantId: string,
  input: { delta: number; reason: MotivoStock; note?: string },
): Promise<ResultadoAccion> {
  await exigirEdicion(slug);
  if (!Number.isFinite(input.delta) || input.delta === 0) {
    return { ok: false, message: "Ingresá una cantidad distinta de cero" };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_stock", {
    p_variant_id: variantId,
    p_delta: input.delta,
    p_reason: input.reason,
    p_note: input.note || undefined,
  });
  if (error) return { ok: false, message: error.message };
  revalidar(slug);
  return { ok: true, message: "Stock ajustado" };
}
