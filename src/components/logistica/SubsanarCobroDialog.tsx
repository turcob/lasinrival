import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

interface SubsanarCobroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cobro: {
    id: string;
    monto: number;
    forma_pago: { id: string; nombre: string };
    pedido?: { numero_pedido: number };
  } | null;
  onSuccess: () => void;
}

/**
 * Permite a Administración reclasificar un cobro registrado por el fletero
 * (por ejemplo, cambiar el medio de pago original a Transferencia y dejar
 * constancia de "subsanado administrativo" cuando la transferencia no llegó
 * a tiempo).
 */
export function SubsanarCobroDialog({ open, onOpenChange, cobro, onSuccess }: SubsanarCobroDialogProps) {
  const { user } = useAuth();
  const [formasPago, setFormasPago] = useState<Array<{ id: string; nombre: string }>>([]);
  const [nuevaFormaPagoId, setNuevaFormaPagoId] = useState<string>('');
  const [observaciones, setObservaciones] = useState('');
  const [marcarSubsanado, setMarcarSubsanado] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setObservaciones('');
    setMarcarSubsanado(true);
    setNuevaFormaPagoId(cobro?.forma_pago?.id || '');
    supabase
      .from('formas_pago')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => setFormasPago(data || []));
  }, [open, cobro]);

  const handleGuardar = async () => {
    if (!cobro || !user || !nuevaFormaPagoId) return;
    setLoading(true);
    try {
      const cambioMedioPago = nuevaFormaPagoId !== cobro.forma_pago.id;
      const payload: any = {};

      if (cambioMedioPago) {
        payload.forma_pago_id = nuevaFormaPagoId;
        payload.medio_pago_original_id = cobro.forma_pago.id;
      }
      if (marcarSubsanado) {
        payload.subsanado_administrativo = true;
        payload.subsanado_observaciones = observaciones || null;
        payload.subsanado_por = user.id;
        payload.subsanado_at = new Date().toISOString();
      }

      if (Object.keys(payload).length === 0) {
        toast.info('No hay cambios a guardar');
        return;
      }

      const { error } = await supabase
        .from('hoja_ruta_cobros')
        .update(payload)
        .eq('id', cobro.id);

      if (error) throw error;
      toast.success('Cobro reclasificado');
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      console.error('Error subsanando cobro:', e);
      toast.error(e.message || 'No se pudo reclasificar');
    } finally {
      setLoading(false);
    }
  };

  if (!cobro) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Reclasificar cobro
          </DialogTitle>
          <DialogDescription>
            Pedido #{cobro.pedido?.numero_pedido || '—'} · ${cobro.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            <br />
            Forma de pago original: <strong>{cobro.forma_pago.nombre}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nueva forma de pago</Label>
            <Select value={nuevaFormaPagoId} onValueChange={setNuevaFormaPagoId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                {formasPago.map((fp) => (
                  <SelectItem key={fp.id} value={fp.id}>{fp.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-3 border rounded">
            <div>
              <p className="font-medium text-sm">Subsanado administrativo</p>
              <p className="text-xs text-muted-foreground">
                Dejar constancia que este cambio es una corrección administrativa.
              </p>
            </div>
            <Switch checked={marcarSubsanado} onCheckedChange={setMarcarSubsanado} />
          </div>

          {marcarSubsanado && (
            <div className="space-y-1.5">
              <Label>Observaciones (motivo)</Label>
              <Textarea
                rows={3}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Ej: la transferencia no llegó a tiempo, se reclasifica el cobro."
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleGuardar} disabled={loading || !nuevaFormaPagoId}>
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}