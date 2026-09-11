export const metadata = { title: "Impresión — Catálogo" };

const CSS = `
  .hoja { color: #1a1d21; }
  .hoja * { border-color: #e6e8ec; }
  .papel {
    background: #fff;
    box-shadow: 0 1px 2px rgba(16,24,40,.04), 0 12px 32px -12px rgba(16,24,40,.14);
    border-radius: 14px;
  }
  @page { size: A4; margin: 12mm; }
  @media screen {
    .hoja { background: #eef0f3; }
  }
  @media print {
    .no-print { display: none !important; }
    html, body { background: #fff !important; }
    .hoja { background: #fff !important; }
    .papel { box-shadow: none !important; border-radius: 0 !important; }
    .evitar-corte { break-inside: avoid; }
    .salto { break-after: page; }
    a[href]:after { content: none !important; }
    * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }
`;

export default function ImprimirLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="hoja min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {children}
    </div>
  );
}
