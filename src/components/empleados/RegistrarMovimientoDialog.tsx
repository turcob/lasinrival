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

interface RegistrarMovimientoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empleadoId: string;
  onSuccess: () => void;
}

const TIPOS_MOVIMIENTO = [
  { value: 'compra', label: 'Compra (suma a deuda)', description: 'Compra realizada por el empleado' },
  { value: 'adelanto', label: 'Adelanto (suma a deuda)', description: 'Adelanto de sueldo' },
  { value: 'devolucion', label: 'Devolución (resta de deuda)', description: 'Devolución de producto o ajuste a favor' },
  { value: 'ajuste', label: 'Ajuste', description: 'Ajuste manual de cuenta' },
  { value: 'comision', label: 'Comisión (bonificación)', description: 'Comisión o bonificación a pagar' },
];

export function RegistrarMovimientoDialog({ open, onOpenChange, empleadoId, onSuccess }: RegistrarMovimientoDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    tipo: '',
    monto: '',
    concepto: '',
    fecha: new Date().toISOString().split('T')[0],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const monto = parseFloat(formData.monto);
    if (isNaN(monto) || monto <= 0) {
      toast.error('Ingrese un monto válido');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('empleado_movimientos').insert([{
        empleado_id: empleadoId,
        tipo: formData.tipo,
        monto,
        concepto: formData.concepto || null,
        fecha: formData.fecha,
        usuario_registro_id: user.id,
      }]);

      if (error) throw error;

      toast.success('Movimiento registrado correctamente');
      setFormData({
        tipo: '',
        monto: '',
        concepto: '',
        fecha: new Date().toISOString().split('T')[0],
      });
      onSuccess();
    } catch (error) {
      console.error('Error registering movimiento:', error);
      toast.error('Error al registrar el movimiento');
    } finally {
      setLoading(false);
    }
  };

  const selectedTipo = TIPOS_MOVIMIENTO.find(t => t.value === formData.tipo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Movimiento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo de Movimiento *</Label>
            <Select
              value={formData.tipo}
              onValueChange={(value) => setFormData({ ...formData, tipo: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_MOVIMIENTO.map((tipo) => (
                  <SelectItem key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTipo && (
              <p className="text-xs text-muted-foreground">{selectedTipo.description}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="monto">Monto *</Label>
              <Input
                id="monto"
                type="number"
                step="0.01"
                min="0.01"
                value={formData.monto}
                onChange={(e) => setFormData({ ...formData, monto: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha</Label>
              <Input
                id="fecha"
                type="date"
                value={formData.fecha}
                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="concepto">Concepto / Descripción</Label>
            <Textarea
              id="concepto"
              value={formData.concepto}
              onChange={(e) => setFormData({ ...formData, concepto: e.target.value })}
              placeholder="Descripción del movimiento..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !formData.tipo}>
              {loading ? 'Guardando...' : 'Registrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
