import { Card, CardContent } from '@/components/ui/card';
import { useCobrosHojaRuta, useHojaRuta } from '@/hooks/useLogistica';
import { clasificarMedioPago } from '@/hooks/useEncargado';
import { useMemo } from 'react';

export function ResumenCobrosTab({ hojaRutaId }: { hojaRutaId: string }) {
  const { data: cobros = [] } = useCobrosHojaRuta(hojaRutaId);
  const { data: hoja } = useHojaRuta(hojaRutaId);
  const paradas: any[] = (hoja as any)?.paradas ?? [];
  const totales: Record<string, number> = { efectivo: 0, transferencias: 0, qr: 0, tarjeta: 0, otro: 0 };
  const cantidades: Record<string, number> = { efectivo: 0, transferencias: 0, qr: 0, tarjeta: 0, otro: 0 };
  cobros.forEach((c: any) => {
    const tipo = clasificarMedioPago(c.forma_pago?.nombre ?? c.medio_pago ?? '');
    totales[tipo] += Number(c.monto);
    cantidades[tipo] += 1;
  });
  const total = Object.values(totales).reduce((s, v) => s + v, 0);
  const labels: Record<string, string> = {
    efectivo: 'Efectivo', transferencias: 'Transferencias', qr: 'QR', tarjeta: 'Tarjeta', otro: 'Otros',
  };

  const cobrosPorCliente = useMemo(() => {
    const map = new Map<string, { cliente: string; total: number; medios: Set<string> }>();
    cobros.forEach((c: any) => {
      const cliente = c.pedido?.cliente?.nombre
        ?? paradas.find((p: any) => p.id === c.parada?.id)?.pedido?.cliente?.nombre
        ?? `Pedido #${c.pedido?.numero_pedido ?? '?'}`;
      const cur = map.get(cliente) ?? { cliente, total: 0, medios: new Set<string>() };
      cur.total += Number(c.monto);
      const fp = c.forma_pago?.nombre ?? c.medio_pago ?? '';
      if (fp) cur.medios.add(fp);
      map.set(cliente, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [cobros, paradas]);

  return (
    <div className="space-y-2">
      {Object.entries(totales).filter(([_, v]) => v > 0).map(([k, v]) => (
        <Card key={k}>
          <CardContent className="p-3 flex justify-between items-center">
            <div className="flex flex-col">
              <span className="font-medium">{labels[k]}</span>
              <span className="text-[11px] text-muted-foreground">
                {cantidades[k]} {cantidades[k] === 1 ? 'cobro realizado' : 'cobros realizados'}
              </span>
            </div>
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

      {cobrosPorCliente.length > 0 && (
        <div className="pt-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">DETALLE POR CLIENTE ({cobrosPorCliente.length})</p>
          <Card>
            <CardContent className="p-0 divide-y">
              {cobrosPorCliente.map((c, i) => (
                <div key={i} className="p-3">
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-sm font-medium truncate flex-1">{c.cliente}</p>
                    <span className="font-semibold text-sm">${c.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{Array.from(c.medios).join(' · ')}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}