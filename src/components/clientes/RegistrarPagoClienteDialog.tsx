import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface RegistrarPagoClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string;
  onSuccess: () => void;
}

const TIPOS_MOVIMIENTO = [
  { value: 'pago', label: 'Pago' },
  { value: 'devolucion', label: 'Devolución' },
  { value: 'nota_debito', label: 'Nota de Débito' },
  { value: 'nota_credito', label: 'Nota de Crédito' },
  { value: 'anulacion', label: 'Anulación de Compra' },
];

export function RegistrarPagoClienteDialog({ open, onOpenChange, clienteId, onSuccess }: RegistrarPagoClienteDialogProps) {
  const { user } = useAuth();
  const [tipo, setTipo] = useState('pago');
  const [monto, setMonto] = useState('');
  const [concepto, setConcepto] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const montoNum = parseFloat(monto.replace(',', '.'));
    if (isNaN(montoNum) || montoNum <= 0) {
      toast.error('Ingrese un monto válido');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('cliente_movimientos').insert([{
        cliente_id: clienteId,
        tipo,
        monto: montoNum,
        concepto: concepto || null,
        usuario_registro_id: user.id,
      }]);

      if (error) throw error;

      toast.success('Movimiento registrado correctamente');
      setTipo('pago');
      setMonto('');
      setConcepto('');
      onSuccess();
    } catch (error) {
      console.error('Error registering movement:', error);
      toast.error('Error al registrar el movimiento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Movimiento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de movimiento</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_MOVIMIENTO.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Monto</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Concepto (opcional)</Label>
            <Textarea
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Descripción del movimiento"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Registrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
