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
  const [otrosMedios, setOtrosMedios] = useState({
    posnet: 0,
    transferencias: 0,
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
      const [detallesRes, otrosRes] = await Promise.all([
        supabase.from('arqueo_detalles').select('*').eq('caja_id', caja.id),
        supabase.from('arqueo_otros_medios').select('*').eq('caja_id', caja.id),
      ]);

      // Cargar denominaciones
      const nuevasDenominaciones: Record<string, number> = {
        '20000': 0, '10000': 0, '2000': 0, '1000': 0, '500': 0, '200': 0, '100': 0,
      };
      (detallesRes.data || []).forEach((d) => {
        nuevasDenominaciones[d.denominacion.toString()] = d.cantidad;
      });
      setArqueo(nuevasDenominaciones);

      // Cargar otros medios
      const nuevosOtros = { posnet: 0, transferencias: 0 };
      (otrosRes.data || []).forEach((o) => {
        if (o.tipo === 'posnet') nuevosOtros.posnet = o.monto;
        if (o.tipo === 'transferencias') nuevosOtros.transferencias = o.monto;
      });
      setOtrosMedios(nuevosOtros);

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

  const totalArqueo = totalEfectivo + otrosMedios.posnet + otrosMedios.transferencias;

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

      // Insertar nuevos otros medios
      const otrosMediosInserts = [];
      if (otrosMedios.posnet > 0) {
        otrosMediosInserts.push({
          caja_id: caja.id,
          tipo: 'posnet',
          monto: otrosMedios.posnet,
        });
      }
      if (otrosMedios.transferencias > 0) {
        otrosMediosInserts.push({
          caja_id: caja.id,
          tipo: 'transferencias',
          monto: otrosMedios.transferencias,
        });
      }

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

            {/* Otros Medios de Pago */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Comprobantes Posnet y Transferencias</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="posnet">Comprobantes Posnet (Débito/Crédito)</Label>
                    <Input
                      id="posnet"
                      type="number"
                      min="0"
                      step="0.01"
                      value={otrosMedios.posnet || ''}
                      onChange={(e) => setOtrosMedios({
                        ...otrosMedios,
                        posnet: parseFloat(e.target.value) || 0
                      })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transferencias">Transferencias Bancarias</Label>
                    <Input
                      id="transferencias"
                      type="number"
                      min="0"
                      step="0.01"
                      value={otrosMedios.transferencias || ''}
                      onChange={(e) => setOtrosMedios({
                        ...otrosMedios,
                        transferencias: parseFloat(e.target.value) || 0
                      })}
                      placeholder="0.00"
                    />
                  </div>
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
