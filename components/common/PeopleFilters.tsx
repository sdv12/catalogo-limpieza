"use client";

import { BuscadorUrl, SelectUrl, CheckboxUrl } from "@/components/common/FiltrosUrl";

/** Filtros de listado para Clientes y Proveedores (búsqueda + estado + eliminados). */
export function PeopleFilters({
  placeholder,
  extra,
}: {
  placeholder: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <BuscadorUrl placeholder={placeholder} />

      <SelectUrl param="estado" ariaLabel="Estado" className="w-full sm:w-36">
        <option value="">Todos</option>
        <option value="activo">Activos</option>
        <option value="inactivo">Inactivos</option>
      </SelectUrl>

      {extra}

      <CheckboxUrl param="eliminados" label="Ver eliminados" />
    </div>
  );
}
