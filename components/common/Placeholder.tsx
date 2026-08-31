import { Card, CardBody } from "@/components/ui/Card";

export function Placeholder({
  titulo,
  descripcion,
  etapa,
}: {
  titulo: string;
  descripcion: string;
  etapa: string;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-texto">{titulo}</h1>
        <p className="mt-1 text-sm text-texto-sec">{descripcion}</p>
      </div>
      <Card>
        <CardBody>
          <p className="text-sm text-texto-sec">
            Esta sección se implementa en la {etapa}.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
