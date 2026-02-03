import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { FileCheck, Banknote, Smartphone, CreditCard, AlertTriangle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Cobro {
  id: string;
  monto: number;
  referencia: string | null;
  forma_pago: { id: string; nombre: string };
  pedido: { numero_pedido: number };
  parada: { id: string };
}

interface ResumenPorMedio {
  forma_pago_id: string;
  nombre: string;
  total: number;
}

interface RendicionHojaRutaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hojaRutaId: string;
  numeroHoja: number;
  onSuccess: () => void;
}

export function RendicionHojaRutaDialog({
  open,
  onOpenChange,
  hojaRutaId,
  numeroHoja,
  onSuccess,
}: RendicionHojaRutaDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [resumen, setResumen] = useState<ResumenPorMedio[]>([]);
  const [rendicionExistente, setRendicionExistente] = useState<any>(null);
  const [observaciones, setObservaciones] = useState('');

  // Montos declarados por el chofer
  const [efectivoDeclarado, setEfectivoDeclarado] = useState<number>(0);
  const [transferenciasDeclarado, setTransferenciasDeclarado] = useState<number>(0);
  const [qrDeclarado, setQrDeclarado] = useState<number>(0);
  const [tarjetaDeclarado, setTarjetaDeclarado] = useState<number>(0);

  useEffect(() => {
    if (open && hojaRutaId) {
      loadData();
    }
  }, [open, hojaRutaId]);

  const loadData = async () => {
    try {
      // Cargar cobros de la hoja de ruta
      const { data: cobrosData } = await supabase
        .from('hoja_ruta_cobros')
        .select(`
          id,
          monto,
          referencia,
          forma_pago:formas_pago(id, nombre),
          pedido:pedidos(numero_pedido),
          parada:hoja_ruta_paradas(id)
        `)
        .eq('hoja_ruta_id', hojaRutaId);

      if (cobrosData) {
        const formattedCobros = cobrosData.map(c => ({
          ...c,
          forma_pago: c.forma_pago as unknown as { id: string; nombre: string },
          pedido: c.pedido as unknown as { numero_pedido: number },
          parada: c.parada as unknown as { id: string },
        }));
        setCobros(formattedCobros);

        // Calcular resumen por medio de pago
        const resumenMap = new Map<string, ResumenPorMedio>();
        formattedCobros.forEach(cobro => {
          const fpId = cobro.forma_pago.id;
          const existing = resumenMap.get(fpId);
          if (existing) {
            existing.total += cobro.monto;
          } else {
            resumenMap.set(fpId, {
              forma_pago_id: fpId,
              nombre: cobro.forma_pago.nombre,
              total: cobro.monto,
            });
          }
        });
        setResumen(Array.from(resumenMap.values()));

        // Pre-llenar los montos declarados con los totales
        Array.from(resumenMap.values()).forEach(r => {
          const lower = r.nombre.toLowerCase();
          if (lower.includes('efectivo')) setEfectivoDeclarado(r.total);
          else if (lower.includes('transfer')) setTransferenciasDeclarado(r.total);
          else if (lower.includes('qr') || lower.includes('mercado')) setQrDeclarado(r.total);
          else if (lower.includes('tarjeta')) setTarjetaDeclarado(r.total);
        });
      }

      // Verificar si ya existe una rendición
      const { data: rendicion } = await supabase
        .from('hoja_ruta_rendiciones')
        .select('*')
        .eq('hoja_ruta_id', hojaRutaId)
        .maybeSingle();

      setRendicionExistente(rendicion);
      if (rendicion) {
        setObservaciones(rendicion.observaciones || '');
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const getTotalSistema = (tipo: string) => {
    return resumen
      .filter(r => r.nombre.toLowerCase().includes(tipo))
      .reduce((sum, r) => sum + r.total, 0);
  };

  const totalSistema = cobros.reduce((sum, c) => sum + c.monto, 0);
  const totalDeclarado = efectivoDeclarado + transferenciasDeclarado + qrDeclarado + tarjetaDeclarado;
  const diferencia = totalDeclarado - totalSistema;

  const getIcono = (nombre: string) => {
    const lower = nombre.toLowerCase();
    if (lower.includes('efectivo')) return <Banknote className="h-4 w-4" />;
    if (lower.includes('transfer') || lower.includes('qr')) return <Smartphone className="h-4 w-4" />;
    if (lower.includes('tarjeta')) return <CreditCard className="h-4 w-4" />;
    return null;
  };

  const handleSubmit = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const rendicionData = {
        hoja_ruta_id: hojaRutaId,
        usuario_id: user.id,
        total_efectivo: efectivoDeclarado,
        total_transferencias: transferenciasDeclarado,
        total_qr: qrDeclarado,
        total_tarjeta: tarjetaDeclarado,
        total_general: totalDeclarado,
        diferencia,
        estado: 'pendiente' as const,
        observaciones: observaciones || null,
      };

      if (rendicionExistente) {
        const { error } = await supabase
          .from('hoja_ruta_rendiciones')
          .update(rendicionData)
          .eq('id', rendicionExistente.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('hoja_ruta_rendiciones').insert(rendicionData);
        if (error) throw error;
      }

      // Actualizar estado de la hoja de ruta a "completada"
      await supabase
        .from('hojas_ruta')
        .update({ estado: 'completada' })
        .eq('id', hojaRutaId);

      toast.success('Rendición registrada correctamente');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error saving rendicion:', error);
      toast.error('Error al guardar la rendición');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            Rendición de Cobranza - Hoja #{numeroHoja}
          </DialogTitle>
          <DialogDescription>
            Declara los montos recaudados para cerrar la hoja de ruta
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resumen de cobros registrados */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Cobros Registrados en Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              {resumen.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay cobros registrados</p>
              ) : (
                <div className="space-y-2">
                  {resumen.map((r) => (
                    <div key={r.forma_pago_id} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        {getIcono(r.nombre)}
                        <span>{r.nombre}</span>
                      </div>
                      <span className="font-medium">
                        ${r.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                  <div className="border-t pt-2 flex justify-between font-bold">
                    <span>Total Sistema:</span>
                    <span>${totalSistema.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Montos declarados */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Declaración de Montos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Banknote className="h-3 w-3" /> Efectivo
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={efectivoDeclarado || ''}
                    onChange={(e) => setEfectivoDeclarado(Number(e.target.value))}
                  />
                  {getTotalSistema('efectivo') > 0 && efectivoDeclarado !== getTotalSistema('efectivo') && (
                    <p className="text-xs text-warning">
                      Sistema: ${getTotalSistema('efectivo').toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Smartphone className="h-3 w-3" /> Transferencias
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={transferenciasDeclarado || ''}
                    onChange={(e) => setTransferenciasDeclarado(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Smartphone className="h-3 w-3" /> QR / Mercado Pago
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={qrDeclarado || ''}
                    onChange={(e) => setQrDeclarado(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <CreditCard className="h-3 w-3" /> Tarjeta
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={tarjetaDeclarado || ''}
                    onChange={(e) => setTarjetaDeclarado(Number(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resultado */}
          <Card className={diferencia === 0 ? 'border-success' : 'border-warning'}>
            <CardContent className="pt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Total Declarado:</span>
                <span className="text-2xl font-bold">
                  ${totalDeclarado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className={`flex justify-between items-center text-sm ${
                diferencia === 0 ? 'text-success' : diferencia > 0 ? 'text-blue-600' : 'text-destructive'
              }`}>
                <span className="flex items-center gap-1">
                  {diferencia === 0 ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  Diferencia:
                </span>
                <span className="font-semibold">
                  {diferencia >= 0 ? '+' : ''}${diferencia.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  {diferencia === 0 && ' ✓'}
                  {diferencia > 0 && ' (Sobrante)'}
                  {diferencia < 0 && ' (Faltante)'}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-1.5">
            <Label>Observaciones</Label>
            <Textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas sobre la rendición, diferencias, etc."
              rows={2}
            />
          </div>

          {rendicionExistente && (
            <Badge variant={
              rendicionExistente.estado === 'aprobada' ? 'default' :
              rendicionExistente.estado === 'rechazada' ? 'destructive' : 'secondary'
            }>
              Estado: {rendicionExistente.estado.charAt(0).toUpperCase() + rendicionExistente.estado.slice(1)}
            </Badge>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {rendicionExistente ? 'Actualizar Rendición' : 'Registrar Rendición'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
