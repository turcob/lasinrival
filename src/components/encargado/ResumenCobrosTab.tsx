import { Card, CardContent } from '@/components/ui/card';
import { useCobrosHojaRuta } from '@/hooks/useLogistica';
import { clasificarMedioPago } from '@/hooks/useEncargado';

export function ResumenCobrosTab({ hojaRutaId }: { hojaRutaId: string }) {
  const { data: cobros = [] } = useCobrosHojaRuta(hojaRutaId);
  const totales: Record<string, number> = { efectivo: 0, transferencias: 0, qr: 0, tarjeta: 0, otro: 0 };
  cobros.forEach((c: any) => {
    const tipo = clasificarMedioPago(c.forma_pago?.nombre ?? c.medio_pago ?? '');
    totales[tipo] += Number(c.monto);
  });
  const total = Object.values(totales).reduce((s, v) => s + v, 0);
  const labels: Record<string, string> = {
    efectivo: 'Efectivo', transferencias: 'Transferencias', qr: 'QR', tarjeta: 'Tarjeta', otro: 'Otros',
  };
  return (
    <div className="space-y-2">
      {Object.entries(totales).filter(([_, v]) => v > 0).map(([k, v]) => (
        <Card key={k}>
          <CardContent className="p-3 flex justify-between items-center">
            <span className="font-medium">{labels[k]}</span>
            <span className="font-bold">${v.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
          </CardContent>
        </Card>
      ))}
      <Card className="border-primary bg-primary/5">
        <CardContent className="p-3 flex justify-between items-center">
          <span className="font-semibold">Total cobrado</span>
          <span className="text-xl font-bold">${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground text-center pt-2">{cobros.length} cobros registrados</p>
    </div>
  );
}