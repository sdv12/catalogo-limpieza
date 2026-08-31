import Papa from "papaparse";
import * as XLSX from "xlsx";

export type FilaImport = {
  _row: number;
  name: string;
  brand: string;
  base_sku: string;
  description: string;
  category: string;
  status: string;
  variant_name: string;
  sku: string;
  size_value: string;
  size_unit: string;
  barcode: string;
  stock: string;
  min_stock: string;
  prices: Record<string, string>;
};

type CampoTexto = Exclude<keyof FilaImport, "_row" | "prices">;

const MAPA_COLUMNA: Record<string, CampoTexto> = {
  nombre: "name",
  marca: "brand",
  sku_base: "base_sku",
  descripcion: "description",
  categoria: "category",
  estado: "status",
  presentacion: "variant_name",
  sku: "sku",
  tamano: "size_value",
  tamano_: "size_value",
  unidad: "size_unit",
  codigo_barras: "barcode",
  stock: "stock",
  stock_minimo: "min_stock",
};

function normHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

/** "1.500,50" → "1500.50" · "1500" → "1500" · "" → "" */
export function limpiarNumero(s: string): string {
  const t = String(s ?? "").trim().replace(/\s/g, "");
  if (!t) return "";
  if (t.includes(",") && t.includes(".")) return t.replace(/\./g, "").replace(",", ".");
  if (t.includes(",")) return t.replace(",", ".");
  return t;
}

export async function leerArchivo(
  file: File,
): Promise<{ headers: string[]; registros: Record<string, unknown>[] }> {
  const nombre = file.name.toLowerCase();

  if (nombre.endsWith(".csv") || file.type === "text/csv") {
    const texto = await file.text();
    const parsed = Papa.parse<Record<string, unknown>>(texto, {
      header: true,
      skipEmptyLines: "greedy",
    });
    return { headers: parsed.meta.fields ?? [], registros: parsed.data };
  }

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const registros = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
    raw: false,
  });
  const headers = registros.length ? Object.keys(registros[0]) : [];
  return { headers, registros };
}

export function normalizarFilas(
  registros: Record<string, unknown>[],
): FilaImport[] {
  return registros.map((r, i) => {
    const fila: FilaImport = {
      _row: i + 2,
      name: "",
      brand: "",
      base_sku: "",
      description: "",
      category: "",
      status: "",
      variant_name: "",
      sku: "",
      size_value: "",
      size_unit: "",
      barcode: "",
      stock: "",
      min_stock: "",
      prices: {},
    };

    for (const [rawKey, rawVal] of Object.entries(r)) {
      const key = normHeader(rawKey);
      const val = String(rawVal ?? "").trim();

      if (key.startsWith("precio_")) {
        const code = key.slice("precio_".length);
        if (val !== "" && code) fila.prices[code] = limpiarNumero(val);
        continue;
      }
      const campo = MAPA_COLUMNA[key];
      if (campo) fila[campo] = val;
    }

    fila.size_value = limpiarNumero(fila.size_value);
    fila.stock = limpiarNumero(fila.stock);
    fila.min_stock = limpiarNumero(fila.min_stock);
    fila.size_unit = fila.size_unit.toLowerCase();
    fila.status = fila.status.toLowerCase();
    return fila;
  });
}

/** Devuelve solo las filas cuyo _row aparece en `ok` (números de fila válidos). */
export function filtrarValidas(filas: FilaImport[], filasOk: number[]): FilaImport[] {
  const set = new Set(filasOk);
  return filas.filter((f) => set.has(f._row));
}
