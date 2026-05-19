import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, ChevronRight } from 'lucide-react';
import type { HojaRutaParada } from '@/hooks/useLogistica';
import { ParadaSheet } from './ParadaSheet';

const estadoColor = (e: string) => {
  if (e === 'entregado') return 'bg-green-500/10 text-green-700 border-green-500/30';
  if (e === 'entrega_parcial') return 'bg-amber-500/10 text-amber-700 border-amber-500/30';
  if (e === 'rechazado') return 'bg-red-500/10 text-red-700 border-red-500/30';
  if (e === 'no_entregado') return 'bg-gray-500/10 text-gray-700 border-gray-500/30';
  return 'bg-blue-500/10 text-blue-700 border-blue-500/30';
};

const estadoLabel: Record<string, string> = {
  pendiente: 'Pendiente', entregado: 'Entregado',
  entrega_parcial: 'Parcial', rechazado: 'Rechazado', no_entregado: 'No entregado',
};

export function ParadasTab({ hojaRutaId, paradas }: { hojaRutaId: string; paradas: HojaRutaParada[] }) {
  const [sel, setSel] = useState<HojaRutaParada | null>(null);

  if (!paradas || paradas.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">Sin paradas asignadas</div>;
  }

  const pendientes = paradas.filter(p => p.estado === 'pendiente').length;

  return (
    <div className="space-y-2">
      <div className="px-1 text-xs text-muted-foreground">
        {pendientes} pendiente{pendientes !== 1 ? 's' : ''} de {paradas.length}
      </div>
      {paradas.map((p) => {
        const total = Number(p.pedido?.total ?? 0);
        return (
          <Card
            key={p.id}
            className="cursor-pointer active:scale-[0.99] transition"
            onClick={() => setSel(p)}
          >
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0">
                {p.orden}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{p.pedido?.cliente?.nombre ?? 'Cliente'}</p>
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                  {p.pedido?.cliente?.direccion && <><MapPin className="h-3 w-3" /> {p.pedido.cliente.direccion}</>}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className={`text-xs ${estadoColor(p.estado)}`}>
                    {estadoLabel[p.estado] ?? p.estado}
                  </Badge>
                  <span className="text-xs font-semibold">${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        );
      })}
      <ParadaSheet
        open={!!sel}
        onOpenChange={(o) => !o && setSel(null)}
        hojaRutaId={hojaRutaId}
        parada={sel}
      />
    </div>
  );
}