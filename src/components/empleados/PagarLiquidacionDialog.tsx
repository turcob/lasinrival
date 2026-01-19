import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Banknote, CreditCard, Building2 } from 'lucide-react';

interface FormaPago {
  id: string;
  nombre: string;
}

interface Caja {
  id: string;
  fondo_inicial: number;
  fecha_apertura: string;
  usuario_id: string;
}

interface PagarLiquidacionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  liquidacionId: string;
  empleadoNombre: string;
  monto: number;
  mes: number;
  anio: number;
  onSuccess: () => void;
  userId: string;
}

const MESES_LABELS: Record<number, string> = {
  1: 'Enero',
  2: 'Febrero',
  3: 'Marzo',
  4: 'Abril',
  5: 'Mayo',
  6: 'Junio',
  7: 'Julio',
  8: 'Agosto',
  9: 'Septiembre',
  10: 'Octubre',
  11: 'Noviembre',
  12: 'Diciembre',
};

export function PagarLiquidacionDialog({
  open,
  onOpenChange,
  liquidacionId,
  empleadoNombre,
  monto,
  mes,
  anio,
  onSuccess,
  userId,
}: PagarLiquidacionDialogProps) {
  const [formasPago, setFormasPago] = useState<FormaPago[]>([]);
  const [cajasAbiertas, setCajasAbiertas] = useState<Caja[]>([]);
  const [selectedFormaPago, setSelectedFormaPago] = useState<string>('');
  const [selectedCaja, setSelectedCaja] = useState<string>('');
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const selectedFormaPagoNombre = formasPago.find(f => f.id === selectedFormaPago)?.nombre?.toLowerCase() || '';
  const esEfectivo = selectedFormaPagoNombre === 'efectivo';

  useEffect(() => {
    if (open) {
      fetchData();
    } else {
      // Reset state when dialog closes
      setSelectedFormaPago('');
      setSelectedCaja('');
      setObservaciones('');
    }
  }, [open]);

  const fetchData = async () => {
    setLoadingData(true);
    try {
      const [formasResult, cajasResult] = await Promise.all([
        supabase.from('formas_pago').select('id, nombre').eq('activo', true),
        supabase.from('cajas').select('id, fondo_inicial, fecha_apertura, usuario_id').eq('estado', 'abierta'),
      ]);

      if (formasResult.data) {
        setFormasPago(formasResult.data);
      }
      if (cajasResult.data) {
        setCajasAbiertas(cajasResult.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoadingData(false);
    }
  };

  const handleConfirmar = async () => {
    if (!selectedFormaPago) {
      toast.error('Debe seleccionar una forma de pago');
      return;
    }

    if (esEfectivo && !selectedCaja) {
      toast.error('Debe seleccionar una caja para pagos en efectivo');
      return;
    }

    setLoading(true);
    try {
      // Update liquidacion with payment info
      const updateData: {
        estado: string;
        fecha_pago: string;
        forma_pago_id: string;
        caja_id?: string;
        observaciones?: string;
      } = {
        estado: 'pagada',
        fecha_pago: new Date().toISOString().split('T')[0],
        forma_pago_id: selectedFormaPago,
      };

      if (esEfectivo && selectedCaja) {
        updateData.caja_id = selectedCaja;
      }

      if (observaciones.trim()) {
        updateData.observaciones = observaciones.trim();
      }

      const { error: updateError } = await supabase
        .from('empleado_liquidaciones')
        .update(updateData)
        .eq('id', liquidacionId);

      if (updateError) throw updateError;

      // If payment is in cash, register the outflow in the cash register
      if (esEfectivo && selectedCaja) {
        const { error: movimientoError } = await supabase.from('movimientos_caja').insert([{
          caja_id: selectedCaja,
          tipo: 'egreso',
          concepto: `Pago liquidación ${empleadoNombre} - ${MESES_LABELS[mes]} ${anio}`,
          monto: monto,
          usuario_id: userId,
        }]);

        if (movimientoError) {
          console.error('Error registering cash movement:', movimientoError);
          toast.error('Liquidación marcada como pagada, pero hubo un error al registrar el egreso en caja');
          onSuccess();
          onOpenChange(false);
          return;
        }
      }

      toast.success('Liquidación pagada y egreso registrado correctamente');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Error al procesar el pago');
    } finally {
      setLoading(false);
    }
  };

  const getFormaPagoIcon = (nombre: string) => {
    const lower = nombre.toLowerCase();
    if (lower === 'efectivo') return <Banknote className="h-4 w-4" />;
    if (lower.includes('tarjeta') || lower.includes('credito') || lower.includes('debito')) {
      return <CreditCard className="h-4 w-4" />;
    }
    return <Building2 className="h-4 w-4" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pagar Liquidación</DialogTitle>
          <DialogDescription>
            Registrar el pago de la liquidación de {empleadoNombre}
          </DialogDescription>
        </DialogHeader>

        {loadingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Monto a pagar:</span>
                <span className="text-xl font-bold">
                  ${monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Período: {MESES_LABELS[mes]} {anio}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="forma-pago">Forma de Pago *</Label>
              <Select value={selectedFormaPago} onValueChange={setSelectedFormaPago}>
                <SelectTrigger id="forma-pago">
                  <SelectValue placeholder="Seleccionar forma de pago" />
                </SelectTrigger>
                <SelectContent>
                  {formasPago.map((fp) => (
                    <SelectItem key={fp.id} value={fp.id}>
                      <div className="flex items-center gap-2">
                        {getFormaPagoIcon(fp.nombre)}
                        {fp.nombre}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {esEfectivo && (
              <div className="space-y-2">
                <Label htmlFor="caja">Caja de Egreso *</Label>
                {cajasAbiertas.length === 0 ? (
                  <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                    No hay cajas abiertas. Debe abrir una caja para poder registrar el egreso en efectivo.
                  </div>
                ) : (
                  <Select value={selectedCaja} onValueChange={setSelectedCaja}>
                    <SelectTrigger id="caja">
                      <SelectValue placeholder="Seleccionar caja" />
                    </SelectTrigger>
                    <SelectContent>
                      {cajasAbiertas.map((caja) => (
                        <SelectItem key={caja.id} value={caja.id}>
                          Caja del {new Date(caja.fecha_apertura!).toLocaleDateString('es-AR')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones (opcional)</Label>
              <Textarea
                id="observaciones"
                placeholder="Notas adicionales sobre el pago..."
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirmar} 
            disabled={loading || loadingData || !selectedFormaPago || (esEfectivo && !selectedCaja)}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Procesando...
              </>
            ) : (
              'Confirmar Pago'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
