import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { CheckCircle, XCircle, AlertTriangle, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ArqueoDetalle {
  denominacion: number;
  cantidad: number;
  subtotal: number;
}

interface ArqueoOtroMedio {
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
  profiles?: { nombre: string } | null;
}

interface ConfirmarArqueoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caja: Caja | null;
  onSuccess: () => void;
}

export function ConfirmarArqueoDialog({ open, onOpenChange, caja, onSuccess }: ConfirmarArqueoDialogProps) {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const [loading, setLoading] = useState(false);
  const [arqueoDetalles, setArqueoDetalles] = useState<ArqueoDetalle[]>([]);
  const [arqueoOtrosMedios, setArqueoOtrosMedios] = useState<ArqueoOtroMedio[]>([]);
  const [aplicarAjuste, setAplicarAjuste] = useState(false);
  const [empleadoId, setEmpleadoId] = useState<string>('');
  const [empleados, setEmpleados] = useState<{ id: string; nombre: string; user_id: string | null }[]>([]);

  useEffect(() => {
    if (open && caja) {
      loadArqueoData();
      loadEmpleados();
      setAplicarAjuste(false);
      setEmpleadoId('');
    }
  }, [open, caja]);

  const loadEmpleados = async () => {
    const { data } = await supabase
      .from('empleados')
      .select('id, nombre, user_id')
      .eq('activo', true)
      .order('nombre');
    const list = (data || []) as { id: string; nombre: string; user_id: string | null }[];
    setEmpleados(list);
    if (caja?.usuario_id) {
      const match = list.find((e) => e.user_id === caja.usuario_id);
      if (match) setEmpleadoId(match.id);
    }
  };

  const loadArqueoData = async () => {
    if (!caja) return;
    try {
      const [detallesRes, otrosRes] = await Promise.all([
        supabase.from('arqueo_detalles').select('*').eq('caja_id', caja.id).order('denominacion', { ascending: false }),
        supabase.from('arqueo_otros_medios').select('*').eq('caja_id', caja.id),
      ]);

      setArqueoDetalles((detallesRes.data || []).map(d => ({
        denominacion: d.denominacion,
        cantidad: d.cantidad,
        subtotal: d.subtotal,
      })));

      setArqueoOtrosMedios((otrosRes.data || []).map(o => ({
        tipo: o.tipo,
        monto: o.monto,
      })));
    } catch (error) {
      console.error('Error loading arqueo data:', error);
    }
  };

  const esperado = caja
    ? caja.fondo_inicial + (caja.total_ventas || 0) - (caja.total_egresos || 0)
    : 0;

  const totalEfectivo = arqueoDetalles.reduce((sum, d) => sum + d.subtotal, 0);
  const totalOtrosMedios = arqueoOtrosMedios.reduce((sum, o) => sum + o.monto, 0);

  const handleConfirmar = async () => {
    if (!caja || !user) return;
    if (aplicarAjuste && !empleadoId) {
      toast.error('Seleccioná el empleado para imputar el ajuste');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.rpc('confirmar_arqueo_con_ajuste', {
        p_caja_id: caja.id,
        p_aplicar_ajuste: aplicarAjuste,
        p_empleado_id: aplicarAjuste ? empleadoId : null,
      });
      if (error) throw error;
      toast.success(
        aplicarAjuste
          ? 'Arqueo confirmado e imputado a la cuenta corriente del empleado'
          : 'Arqueo confirmado correctamente'
      );
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error confirming arqueo:', error);
      toast.error(error?.message || 'Error al confirmar el arqueo');
    } finally {
      setLoading(false);
    }
  };

  const handleRechazar = async () => {
    if (!caja) return;
    setLoading(true);
    try {
      // Marcar como no confirmado y no pendiente para que el usuario pueda volver a editarlo
      const { error } = await supabase
        .from('cajas')
        .update({
          arqueo_pendiente_revision: false,
          arqueo_confirmado: false,
        })
        .eq('id', caja.id);

      if (error) throw error;

      toast.success('Arqueo rechazado. El usuario podrá corregirlo.');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error rejecting arqueo:', error);
      toast.error('Error al rechazar el arqueo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Confirmar Arqueo
          </DialogTitle>
          <DialogDescription>
            Revisa el arqueo antes de confirmarlo. Una vez confirmado, no podrá ser editado.
          </DialogDescription>
        </DialogHeader>

        {caja && (
          <div className="space-y-4">
            {/* Info de la caja */}
            <Card>
              <CardContent className="pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Usuario:</span>
                  <span className="font-medium">{caja.profiles?.nombre || 'Sin asignar'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha Apertura:</span>
                  <span>{format(new Date(caja.fecha_apertura), 'dd/MM/yyyy HH:mm', { locale: es })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha Cierre:</span>
                  <span>{caja.fecha_cierre ? format(new Date(caja.fecha_cierre), 'dd/MM/yyyy HH:mm', { locale: es }) : '-'}</span>
                </div>
              </CardContent>
            </Card>

            {/* Resumen financiero */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Resumen Financiero</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Fondo Inicial:</span>
                  <span>${caja.fondo_inicial.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-success">
                  <span>Ingresos:</span>
                  <span>+${(caja.total_ventas || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-destructive">
                  <span>Egresos:</span>
                  <span>-${(caja.total_egresos || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>Total Esperado:</span>
                  <span>${esperado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
              </CardContent>
            </Card>

            {/* Detalle del arqueo */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Detalle del Arqueo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {arqueoDetalles.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Efectivo</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {arqueoDetalles.map((d) => (
                        <div key={d.denominacion} className="flex justify-between bg-muted/50 px-2 py-1 rounded">
                          <span>${d.denominacion.toLocaleString('es-AR')} x {d.cantidad}</span>
                          <span className="font-medium">${d.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between mt-2 pt-2 border-t">
                      <span className="font-medium">Subtotal Efectivo:</span>
                      <span className="font-bold">${totalEfectivo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )}
                {arqueoOtrosMedios.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Otros Medios</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {arqueoOtrosMedios.map((o) => (
                        <div key={o.tipo} className="flex justify-between bg-muted/50 px-2 py-1 rounded">
                          <span>{o.tipo === 'posnet' ? 'Posnet' : 'Transferencias'}</span>
                          <span className="font-medium">${o.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between mt-2 pt-2 border-t">
                      <span className="font-medium">Subtotal Otros:</span>
                      <span className="font-bold">${totalOtrosMedios.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Resultado */}
            <Card className={(caja.diferencia || 0) === 0 ? 'border-success' : (caja.diferencia || 0) > 0 ? 'border-blue-500' : 'border-destructive'}>
              <CardContent className="pt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Total Contado:</span>
                  <span className="text-2xl font-bold">
                    ${(caja.conteo_declarado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className={`flex justify-between items-center text-sm ${
                  (caja.diferencia || 0) === 0 
                    ? 'text-success' 
                    : (caja.diferencia || 0) > 0 
                      ? 'text-blue-600' 
                      : 'text-destructive'
                }`}>
                  <span>Diferencia:</span>
                  <span className="font-semibold">
                    {(caja.diferencia || 0) >= 0 ? '+' : ''}${(caja.diferencia || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    {(caja.diferencia || 0) === 0 && ' ✓'}
                    {(caja.diferencia || 0) > 0 && ' (Sobrante)'}
                    {(caja.diferencia || 0) < 0 && ' (Faltante)'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Observaciones del cajero
                </CardTitle>
              </CardHeader>
              <CardContent>
                {caja.observaciones && caja.observaciones.trim().length > 0 ? (
                  <p className="text-sm whitespace-pre-wrap">{caja.observaciones}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Sin observaciones registradas</p>
                )}
              </CardContent>
            </Card>

            {isAdmin && (caja.diferencia || 0) !== 0 && (
              <Card className="border-warning/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Ajuste en cuenta corriente del empleado</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="aplicar-ajuste"
                      checked={aplicarAjuste}
                      onCheckedChange={(c) => setAplicarAjuste(c === true)}
                    />
                    <Label htmlFor="aplicar-ajuste" className="text-sm leading-tight cursor-pointer">
                      Imputar {(caja.diferencia || 0) < 0 ? 'faltante (suma deuda)' : 'sobrante (resta deuda)'} a la cuenta corriente del empleado
                    </Label>
                  </div>
                  {aplicarAjuste && (
                    <div className="space-y-1">
                      <Label className="text-xs">Empleado</Label>
                      <Select value={empleadoId} onValueChange={setEmpleadoId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar empleado" />
                        </SelectTrigger>
                        <SelectContent>
                          {empleados.map((e) => (
                            <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Monto: ${Math.abs(caja.diferencia || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleRechazar} disabled={loading}>
                <XCircle className="mr-2 h-4 w-4" />
                Rechazar
              </Button>
              <Button onClick={handleConfirmar} disabled={loading}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Confirmar Arqueo
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
