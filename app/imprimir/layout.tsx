export const metadata = { title: "Impresión — Catálogo" };

const CSS = `
  .hoja { color: #1a1d21; background: #fff; }
  .hoja * { border-color: #e2e5e9; }
  @page { size: A4; margin: 12mm; }
  @media print {
    .no-print { display: none !important; }
    html, body { background: #fff !important; }
    .evitar-corte { break-inside: avoid; }
    .salto { break-after: page; }
    a[href]:after { content: none !important; }
    img { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }
`;

export default function ImprimirLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="hoja min-h-screen bg-white">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {children}
    </div>
  );
}
