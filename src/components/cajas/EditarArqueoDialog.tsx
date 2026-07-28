import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Calculator, Save } from 'lucide-react';

interface ArqueoDetalle {
  id?: string;
  denominacion: number;
  cantidad: number;
  subtotal: number;
}

interface ArqueoOtroMedio {
  id?: string;
  tipo: string;
  monto: number;
}

type CategoriaMedio = 'efectivo' | 'debito' | 'credito' | 'transferencia' | 'cheque' | 'otro';
const CATEGORIAS_NO_EFECTIVO: Exclude<CategoriaMedio, 'efectivo'>[] = [
  'debito', 'credito', 'transferencia', 'cheque', 'otro',
];
const LABEL_CATEGORIA: Record<CategoriaMedio, string> = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  credito: 'Crédito',
  transferencia: 'Transferencia',
  cheque: 'Cheque',
  otro: 'Otro',
};

interface Caja {
  id: string;
  usuario_id: string;
  fondo_inicial: number;
  total_ventas: number | null;
  total_egresos: number | null;
  conteo_declarado: number | null;
  diferencia: number | null;
  estado: 'abierta' | 'cerrada';
  observaciones: string | null;
  fecha_apertura: string;
  fecha_cierre: string | null;
  arqueo_confirmado?: boolean;
  arqueo_pendiente_revision?: boolean;
}

interface EditarArqueoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caja: Caja | null;
  onSuccess: () => void;
}

const denominaciones = [
  { valor: 20000, label: '$20.000' },
  { valor: 10000, label: '$10.000' },
  { valor: 2000, label: '$2.000' },
  { valor: 1000, label: '$1.000' },
  { valor: 500, label: '$500' },
  { valor: 200, label: '$200' },
  { valor: 100, label: '$100' },
];

export function EditarArqueoDialog({ open, onOpenChange, caja, onSuccess }: EditarArqueoDialogProps) {
  const [loading, setLoading] = useState(false);
  const [arqueo, setArqueo] = useState<Record<string, number>>({
    '20000': 0, '10000': 0, '2000': 0, '1000': 0, '500': 0, '200': 0, '100': 0,
  });
  const [esperadoPorCategoria, setEsperadoPorCategoria] = useState<Record<CategoriaMedio, number>>({
    efectivo: 0, debito: 0, credito: 0, transferencia: 0, cheque: 0, otro: 0,
  });
  const [declaradoPorCategoria, setDeclaradoPorCategoria] = useState<Record<CategoriaMedio, number>>({
    efectivo: 0, debito: 0, credito: 0, transferencia: 0, cheque: 0, otro: 0,
  });
  const [observaciones, setObservaciones] = useState('');

  useEffect(() => {
    if (open && caja) {
      loadArqueoData();
    }
  }, [open, caja]);

  const loadArqueoData = async () => {
    if (!caja) return;
    setLoading(true);
    try {
      const [detallesRes, otrosRes, rpcRes] = await Promise.all([
        supabase.from('arqueo_detalles').select('*').eq('caja_id', caja.id),
        supabase.from('arqueo_otros_medios').select('*').eq('caja_id', caja.id),
        supabase.rpc('get_arqueo_por_medio', { p_caja_id: caja.id }),
      ]);

      // Cargar denominaciones
      const nuevasDenominaciones: Record<string, number> = {
        '20000': 0, '10000': 0, '2000': 0, '1000': 0, '500': 0, '200': 0, '100': 0,
      };
      (detallesRes.data || []).forEach((d) => {
        nuevasDenominaciones[d.denominacion.toString()] = d.cantidad;
      });
      setArqueo(nuevasDenominaciones);

      // Esperado por categoría desde RPC
      const esp: Record<CategoriaMedio, number> = {
        efectivo: 0, debito: 0, credito: 0, transferencia: 0, cheque: 0, otro: 0,
      };
      for (const r of ((rpcRes as any).data || []) as Array<{ categoria: string | null; total: number }>) {
        const cat = (r.categoria || 'otro') as CategoriaMedio;
        if (cat in esp) esp[cat] += Number(r.total) || 0;
        else esp.otro += Number(r.total) || 0;
      }
      setEsperadoPorCategoria(esp);

      // Declarado: preferir fila guardada (categoria); fallback a legacy tipo; fallback a esperado
      const dec: Record<CategoriaMedio, number> = { ...esp };
      const otros = (otrosRes.data || []) as Array<{ tipo: string; monto: number; categoria?: string | null }>;
      // Índices por categoria y por tipo legacy
      const porCategoria = new Map<string, number>();
      const porTipoLegacy = new Map<string, number>();
      for (const o of otros) {
        if (o.categoria) porCategoria.set(o.categoria, Number(o.monto) || 0);
        porTipoLegacy.set(o.tipo, Number(o.monto) || 0);
      }
      for (const cat of CATEGORIAS_NO_EFECTIVO) {
        if (porCategoria.has(cat)) {
          dec[cat] = porCategoria.get(cat) || 0;
        } else if (cat === 'transferencia' && porTipoLegacy.has('transferencias')) {
          dec[cat] = porTipoLegacy.get('transferencias') || 0;
        } else if (cat === 'otro' && porTipoLegacy.has('posnet')) {
          dec[cat] = porTipoLegacy.get('posnet') || 0;
        }
      }
      setDeclaradoPorCategoria(dec);

      setObservaciones(caja.observaciones || '');
    } catch (error) {
      console.error('Error loading arqueo data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalEfectivo = Object.entries(arqueo).reduce((sum, [denominacion, cantidad]) => {
    return sum + (parseInt(denominacion) * cantidad);
  }, 0);

  const totalArqueo = totalEfectivo + CATEGORIAS_NO_EFECTIVO.reduce((s, c) => s + (declaradoPorCategoria[c] || 0), 0);

  const esperado = caja
    ? caja.fondo_inicial + (caja.total_ventas || 0) - (caja.total_egresos || 0)
    : 0;

  const handleGuardar = async () => {
    if (!caja) return;
    setLoading(true);
    try {
      const diferencia = totalArqueo - esperado;

      // Eliminar arqueo_detalles existentes
      await supabase.from('arqueo_detalles').delete().eq('caja_id', caja.id);

      // Insertar nuevos arqueo_detalles
      const arqueoInserts = denominaciones
        .filter(d => arqueo[d.valor.toString()] > 0)
        .map(d => ({
          caja_id: caja.id,
          denominacion: d.valor,
          cantidad: arqueo[d.valor.toString()],
          subtotal: d.valor * arqueo[d.valor.toString()],
        }));

      if (arqueoInserts.length > 0) {
        const { error: arqueoError } = await supabase.from('arqueo_detalles').insert(arqueoInserts);
        if (arqueoError) throw arqueoError;
      }

      // Eliminar arqueo_otros_medios existentes
      await supabase.from('arqueo_otros_medios').delete().eq('caja_id', caja.id);

      // Insertar arqueo por categoría (grilla dinámica)
      const otrosMediosInserts = CATEGORIAS_NO_EFECTIVO
        .filter(cat => (declaradoPorCategoria[cat] || 0) > 0 || (esperadoPorCategoria[cat] || 0) > 0)
        .map(cat => ({
          caja_id: caja.id,
          tipo: cat === 'transferencia' ? 'transferencias' : cat === 'otro' ? 'posnet' : cat,
          categoria: cat,
          forma_pago_id: null,
          monto: declaradoPorCategoria[cat] || 0,
          esperado: esperadoPorCategoria[cat] || 0,
        }));

      if (otrosMediosInserts.length > 0) {
        const { error: otrosError } = await supabase.from('arqueo_otros_medios').insert(otrosMediosInserts);
        if (otrosError) throw otrosError;
      }

      // Actualizar la caja con los nuevos valores y marcar como pendiente de revisión
      const { error: cajaError } = await supabase
        .from('cajas')
        .update({
          conteo_declarado: totalArqueo,
          diferencia: diferencia,
          observaciones: observaciones || null,
          arqueo_pendiente_revision: true,
          arqueo_confirmado: false,
        })
        .eq('id', caja.id);

      if (cajaError) throw cajaError;

      toast.success('Arqueo actualizado y enviado para revisión');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error saving arqueo:', error);
      toast.error('Error al guardar el arqueo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Editar Arqueo
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Resumen */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Resumen de Caja</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Fondo Inicial:</span>
                  <span>${caja?.fondo_inicial.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-success">
                  <span>Ingresos:</span>
                  <span>+${(caja?.total_ventas || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-destructive">
                  <span>Egresos:</span>
                  <span>-${(caja?.total_egresos || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>Total Esperado:</span>
                  <span>${esperado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
              </CardContent>
            </Card>

            {/* Arqueo de Billetes */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Conteo de Efectivo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {denominaciones.map((denom) => (
                    <div key={denom.valor} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{denom.label}</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          value={arqueo[denom.valor.toString()] || ''}
                          onChange={(e) => setArqueo({
                            ...arqueo,
                            [denom.valor.toString()]: parseInt(e.target.value) || 0
                          })}
                          className="h-8 text-center"
                          placeholder="0"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-right">
                        ${((arqueo[denom.valor.toString()] || 0) * denom.valor).toLocaleString('es-AR')}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t flex justify-between items-center">
                  <span className="text-sm font-medium">Subtotal Efectivo:</span>
                  <span className="font-bold">${totalEfectivo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
              </CardContent>
            </Card>

            {/* Cotejo por medio de pago */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Cotejo por medio de pago</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-2 items-center text-sm">
                  <div className="font-medium text-muted-foreground">Medio</div>
                  <div className="text-right font-medium text-muted-foreground">Esperado</div>
                  <div className="text-right font-medium text-muted-foreground">Declarado</div>
                  <div className="text-right font-medium text-muted-foreground">Diferencia</div>

                  {(() => {
                    const esp = (caja?.fondo_inicial || 0) + (esperadoPorCategoria.efectivo || 0) - (caja?.total_egresos || 0);
                    const diff = totalEfectivo - esp;
                    return (
                      <>
                        <div>Efectivo</div>
                        <div className="text-right tabular-nums">${esp.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                        <div className="text-right tabular-nums">${totalEfectivo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                        <div className={`text-right tabular-nums font-medium ${Math.abs(diff) < 0.01 ? 'text-success' : 'text-destructive'}`}>
                          {diff >= 0 ? '+' : ''}${diff.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </div>
                      </>
                    );
                  })()}

                  {CATEGORIAS_NO_EFECTIVO.map(cat => {
                    const esp = esperadoPorCategoria[cat] || 0;
                    const dec = declaradoPorCategoria[cat] || 0;
                    if (esp === 0 && dec === 0) return null;
                    const diff = dec - esp;
                    return (
                      <div key={cat} className="contents">
                        <div>{LABEL_CATEGORIA[cat]}</div>
                        <div className="text-right tabular-nums">${esp.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                        <div>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={dec || ''}
                            onChange={(e) => setDeclaradoPorCategoria({
                              ...declaradoPorCategoria,
                              [cat]: parseFloat(e.target.value) || 0,
                            })}
                            className="h-8 text-right tabular-nums"
                            placeholder="0.00"
                          />
                        </div>
                        <div className={`text-right tabular-nums font-medium ${Math.abs(diff) < 0.01 ? 'text-success' : 'text-destructive'}`}>
                          {diff >= 0 ? '+' : ''}${diff.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Total del Arqueo */}
            <Card className={totalArqueo - esperado === 0 ? 'border-success' : totalArqueo - esperado > 0 ? 'border-blue-500' : 'border-destructive'}>
              <CardContent className="pt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Total Contado:</span>
                  <span className="text-2xl font-bold">
                    ${totalArqueo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className={`flex justify-between items-center text-sm ${
                  totalArqueo - esperado === 0 
                    ? 'text-success' 
                    : totalArqueo - esperado > 0 
                      ? 'text-blue-600' 
                      : 'text-destructive'
                }`}>
                  <span>Diferencia:</span>
                  <span className="font-semibold">
                    {totalArqueo - esperado >= 0 ? '+' : ''}${(totalArqueo - esperado).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    {totalArqueo - esperado === 0 && ' ✓'}
                    {totalArqueo - esperado > 0 && ' (Sobrante)'}
                    {totalArqueo - esperado < 0 && ' (Faltante)'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                id="observaciones"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas adicionales sobre la corrección..."
              />
            </div>

            <div className="bg-muted/50 p-3 rounded-lg text-sm text-muted-foreground">
              <p>⚠️ Al guardar, el arqueo quedará pendiente de confirmación por un administrador.</p>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleGuardar} disabled={loading}>
                <Save className="mr-2 h-4 w-4" />
                Guardar y Enviar para Revisión
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
