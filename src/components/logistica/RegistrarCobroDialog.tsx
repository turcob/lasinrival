import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DollarSign, CreditCard, Smartphone, Banknote, Plus, Trash2, ImagePlus, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface FormaPago {
  id: string;
  nombre: string;
}

interface CobroItem {
  forma_pago_id: string;
  monto: number;
  referencia: string;
}

interface RegistrarCobroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hojaRutaId: string;
  paradaId: string;
  pedidoId: string;
  totalPedido: number;
  montoCobrado: number;
  onSuccess: () => void;
}

export function RegistrarCobroDialog({
  open,
  onOpenChange,
  hojaRutaId,
  paradaId,
  pedidoId,
  totalPedido,
  montoCobrado,
  onSuccess,
}: RegistrarCobroDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [formasPago, setFormasPago] = useState<FormaPago[]>([]);
  const [cobros, setCobros] = useState<CobroItem[]>([{ forma_pago_id: '', monto: 0, referencia: '' }]);
  const [observaciones, setObservaciones] = useState('');
  const [fotoComprobante, setFotoComprobante] = useState<File | null>(null);

  useEffect(() => {
    if (open) {
      loadFormasPago();
      setObservaciones('');
      setFotoComprobante(null);
    }
  }, [open]);

  const saldoInicial = totalPedido - montoCobrado;

  const loadFormasPago = async () => {
    const { data } = await supabase
      .from('formas_pago')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre');
    if (data) {
      setFormasPago(data);
      const efectivo = data.find(fp => fp.nombre.toLowerCase().includes('efectivo'));
      setCobros([{
        forma_pago_id: efectivo?.id || '',
        monto: saldoInicial > 0 ? saldoInicial : 0,
        referencia: '',
      }]);
    }
  };

  const agregarCobro = () => {
    // Calculate remaining amount excluding what other cobros already cover
    const otrosCobrosTotal = cobros.reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
    const restante = Math.max(0, saldoInicial - otrosCobrosTotal);
    setCobros([...cobros, { forma_pago_id: '', monto: restante, referencia: '' }]);
  };

  const eliminarCobro = (index: number) => {
    if (cobros.length > 1) {
      setCobros(cobros.filter((_, i) => i !== index));
    }
  };

  const actualizarCobro = (index: number, field: keyof CobroItem, value: string | number) => {
    const newCobros = [...cobros];
    newCobros[index] = { ...newCobros[index], [field]: value };
    
    // When changing monto on non-first items, auto-adjust the first item
    if (field === 'monto' && index !== 0 && newCobros.length > 1) {
      const otrosTotal = newCobros.slice(1).reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
      newCobros[0] = { ...newCobros[0], monto: Math.max(0, saldoInicial - otrosTotal) };
    }
    
    setCobros(newCobros);
  };

  const totalCobros = cobros.reduce((sum, c) => sum + (Number(c.monto) || 0), 0);
  const saldoPendiente = totalPedido - montoCobrado - totalCobros;

  const getIconoFormaPago = (nombre: string) => {
    const lower = nombre.toLowerCase();
    if (lower.includes('efectivo')) return <Banknote className="h-4 w-4" />;
    if (lower.includes('transfer')) return <Smartphone className="h-4 w-4" />;
    if (lower.includes('qr') || lower.includes('mercado')) return <Smartphone className="h-4 w-4" />;
    if (lower.includes('tarjeta') || lower.includes('debito') || lower.includes('credito')) {
      return <CreditCard className="h-4 w-4" />;
    }
    return <DollarSign className="h-4 w-4" />;
  };

  const handleSubmit = async () => {
    if (!user) return;

    const cobrosValidos = cobros.filter(c => c.forma_pago_id && c.monto > 0);
    if (cobrosValidos.length === 0) {
      toast.error('Ingresa al menos un cobro válido');
      return;
    }

    setLoading(true);
    try {
      let fotoPath: string | null = null;
      let fotoNombre: string | null = null;

      if (fotoComprobante) {
        const extension = fotoComprobante.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${hojaRutaId}/${paradaId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from('comprobantes-cobros')
          .upload(fileName, fotoComprobante, {
            cacheControl: '3600',
            upsert: false,
            contentType: fotoComprobante.type || 'image/jpeg',
          });

        if (uploadError) throw uploadError;
        fotoPath = fileName;
        fotoNombre = fotoComprobante.name;
      }

      // Insertar todos los cobros
      const cobrosPayload = cobrosValidos.map(c => ({
        hoja_ruta_id: hojaRutaId,
        parada_id: paradaId,
        pedido_id: pedidoId,
        forma_pago_id: c.forma_pago_id,
        monto: c.monto,
        referencia: c.referencia || null,
        observaciones: observaciones || null,
        usuario_id: user.id,
        foto_comprobante_path: fotoPath,
        foto_comprobante_nombre: fotoNombre,
      }));

      const { error: cobrosError } = await supabase.from('hoja_ruta_cobros').insert(
        cobrosPayload as any
      );

      if (cobrosError) throw cobrosError;

      // Actualizar el pedido con el monto cobrado
      const nuevoMontoCobrado = montoCobrado + totalCobros;
      const { error: pedidoError } = await supabase
        .from('pedidos')
        .update({
          monto_cobrado: nuevoMontoCobrado,
          cobrado_en_entrega: nuevoMontoCobrado >= totalPedido,
        })
        .eq('id', pedidoId);

      if (pedidoError) throw pedidoError;

      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['cobros-hoja-ruta', hojaRutaId] });
      queryClient.invalidateQueries({ queryKey: ['cobros-parada', paradaId] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });

      toast.success(`Cobro registrado: $${totalCobros.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`);
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error registering payment:', error);
      toast.error('Error al registrar el cobro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-success" />
            Registrar Cobro
          </DialogTitle>
          <DialogDescription>
            Total del pedido: ${totalPedido.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            {montoCobrado > 0 && (
              <span className="text-success ml-2">
                (Ya cobrado: ${montoCobrado.toLocaleString('es-AR', { minimumFractionDigits: 2 })})
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {cobros.map((cobro, index) => (
            <Card key={index} className="border-muted">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Pago #{index + 1}</Label>
                  {cobros.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => eliminarCobro(index)}
                      className="h-8 w-8 text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Forma de Pago</Label>
                    <Select
                      value={cobro.forma_pago_id}
                      onValueChange={(value) => actualizarCobro(index, 'forma_pago_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {formasPago.map((fp) => (
                          <SelectItem key={fp.id} value={fp.id}>
                            <div className="flex items-center gap-2">
                              {getIconoFormaPago(fp.nombre)}
                              {fp.nombre}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Monto</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={cobro.monto || ''}
                      onChange={(e) => actualizarCobro(index, 'monto', Number(e.target.value))}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Referencia (opcional)</Label>
                  <Input
                    value={cobro.referencia}
                    onChange={(e) => actualizarCobro(index, 'referencia', e.target.value)}
                    placeholder="Nº transferencia, comprobante, etc."
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          <Button type="button" variant="outline" className="w-full" onClick={agregarCobro}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar otro medio de pago
          </Button>

          <div className="space-y-1.5">
            <Label>Observaciones (opcional)</Label>
            <Textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas adicionales sobre el cobro..."
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Foto del comprobante (opcional)</Label>
            {fotoComprobante ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-input px-3 py-2 text-sm">
                <span className="truncate">{fotoComprobante.name}</span>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFotoComprobante(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input px-3 py-3 text-sm text-muted-foreground hover:bg-muted/50">
                <ImagePlus className="h-4 w-4" />
                Adjuntar foto
                <Input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => setFotoComprobante(e.target.files?.[0] || null)}
                />
              </label>
            )}
          </div>

          <Card className={saldoPendiente <= 0 ? 'border-success bg-success/5' : 'border-warning bg-warning/5'}>
            <CardContent className="pt-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Total a cobrar ahora:</span>
                <span className="font-bold">${totalCobros.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className={`flex justify-between text-sm ${saldoPendiente <= 0 ? 'text-success' : 'text-warning'}`}>
                <span>{saldoPendiente <= 0 ? 'Pedido completo ✓' : 'Saldo pendiente:'}</span>
                <span className="font-semibold">
                  {saldoPendiente <= 0 ? '' : `$${saldoPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={loading || totalCobros <= 0}>
              Registrar Cobro
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
