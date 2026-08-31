export type ColumnaPlantilla = {
  label: string;
  ejemplo: string;
  obligatorio?: boolean;
  ayuda?: string;
};

/** Columnas de la plantilla de importación (las de precio dependen del catálogo). */
export function columnasImport(
  tiers: { code: string; name: string }[],
): ColumnaPlantilla[] {
  return [
    { label: "nombre", ejemplo: "Detergente concentrado", obligatorio: true },
    { label: "marca", ejemplo: "Marca X" },
    {
      label: "sku_base",
      ejemplo: "DET-001",
      obligatorio: true,
      ayuda: "Código del producto. Filas con el mismo sku_base se agrupan como presentaciones de un mismo producto.",
    },
    { label: "descripcion", ejemplo: "Detergente lavavajillas concentrado" },
    {
      label: "categoria",
      ejemplo: "Cocina",
      obligatorio: true,
      ayuda: "Nombre o identificador de una categoría existente del catálogo.",
    },
    { label: "estado", ejemplo: "active", ayuda: "active o inactive (por defecto active)" },
    { label: "presentacion", ejemplo: "Bidón 5 L", obligatorio: true },
    { label: "sku", ejemplo: "DET-001-5L", obligatorio: true, ayuda: "Único en el catálogo." },
    { label: "tamano", ejemplo: "5" },
    { label: "unidad", ejemplo: "l", ayuda: "ml, l, g, kg o u" },
    { label: "codigo_barras", ejemplo: "7790001234567" },
    { label: "stock", ejemplo: "100" },
    { label: "stock_minimo", ejemplo: "10" },
    ...tiers.map((t) => ({
      label: `precio_${t.code}`,
      ejemplo: "1500",
      ayuda: `Precio para el nivel "${t.name}"`,
    })),
  ];
}

function celdaCSV(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function generarCSV(cols: ColumnaPlantilla[]): string {
  const encabezado = cols.map((c) => c.label).join(",");
  const ejemplo = cols.map((c) => celdaCSV(c.ejemplo)).join(",");
  return `${encabezado}\n${ejemplo}\n`;
}
