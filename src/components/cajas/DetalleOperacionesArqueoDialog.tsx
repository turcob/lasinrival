import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { type CategoriaMedio, LABEL_CATEGORIA } from './categoriaMedio';

interface Operacion {
  id: string;
  monto: number;
  terminal: string | null;
  lote: string | null;
  forma_pago_nombre: string;
  venta_id: string;
  numero_comprobante: number | null;
  fecha: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cajaId: string | null;
  categoria: CategoriaMedio | null;
  esperado: number;
}

export function DetalleOperacionesArqueoDialog({ open, onOpenChange, cajaId, categoria, esperado }: Props) {
  const [ops, setOps] = useState<Operacion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !cajaId || !categoria) return;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('venta_pagos')
        .select(`
          id, monto, terminal, lote,
          forma_pago:formas_pago!inner ( nombre, categoria ),
          venta:ventas!inner ( id, numero_comprobante, fecha, caja_id, anulada, estado )
        `)
        .eq('venta.caja_id', cajaId)
        .eq('venta.anulada', false)
        .eq('venta.estado', 'confirmada')
        .eq('forma_pago.categoria', categoria)
        .order('fecha', { referencedTable: 'venta', ascending: true });

      if (error) {
        console.error('Error cargando operaciones', error);
        setOps([]);
      } else {
        const rows: Operacion[] = (data || []).map((r: any) => ({
          id: r.id,
          monto: Number(r.monto) || 0,
          terminal: r.terminal,
          lote: r.lote,
          forma_pago_nombre: r.forma_pago?.nombre || '-',
          venta_id: r.venta?.id,
          numero_comprobante: r.venta?.numero_comprobante ?? null,
          fecha: r.venta?.fecha,
        }));
        setOps(rows);
      }
      setLoading(false);
    };
    load();
  }, [open, cajaId, categoria]);

  const total = ops.reduce((s, o) => s + o.monto, 0);
  const diff = total - esperado;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Operaciones — {categoria ? LABEL_CATEGORIA[categoria] : ''}
          </DialogTitle>
          <DialogDescription>
            Detalle de cobros que componen esta categoría en el arqueo.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Cargando…</p>
        ) : ops.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Sin operaciones registradas.</p>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Fecha</th>
                    <th className="text-left px-3 py-2 font-medium">Comprobante</th>
                    <th className="text-left px-3 py-2 font-medium">Medio</th>
                    <th className="text-left px-3 py-2 font-medium">Terminal</th>
                    <th className="text-left px-3 py-2 font-medium">Lote</th>
                    <th className="text-right px-3 py-2 font-medium">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {ops.map((o) => (
                    <tr key={o.id} className="border-t">
                      <td className="px-3 py-2">{o.fecha ? format(new Date(o.fecha), 'dd/MM/yyyy HH:mm', { locale: es }) : '-'}</td>
                      <td className="px-3 py-2">{o.numero_comprobante ? `#${String(o.numero_comprobante).padStart(8, '0')}` : '-'}</td>
                      <td className="px-3 py-2">{o.forma_pago_nombre}</td>
                      <td className="px-3 py-2">{o.terminal || '-'}</td>
                      <td className="px-3 py-2">{o.lote || '-'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        ${o.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30">
                    <td className="px-3 py-2 font-medium" colSpan={5}>Total</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold">
                      ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex justify-between text-xs text-muted-foreground px-1">
              <span>Esperado (grilla): ${esperado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              <span className={Math.abs(diff) < 0.01 ? 'text-success' : 'text-destructive'}>
                Diferencia con esperado: {diff >= 0 ? '+' : ''}${diff.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}