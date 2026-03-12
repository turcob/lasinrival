import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proveedorId: string;
  onSave: (data: any) => Promise<boolean>;
}

const tipoOptions = [
  { value: 'factura', label: 'Factura' },
  { value: 'pago', label: 'Pago' },
  { value: 'nota_credito', label: 'Nota de Crédito' },
  { value: 'nota_debito', label: 'Nota de Débito' },
  { value: 'ajuste', label: 'Ajuste' },
];

const medioPagoOptions = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia Bancaria' },
  { value: 'cheque_propio', label: 'Cheque Propio' },
  { value: 'cheque_tercero', label: 'Cheque de Tercero' },
];

interface Caja {
  id: string;
  usuario_id: string;
  fecha_apertura: string;
  fondo_inicial: number;
  estado: string;
  profile_nombre?: string;
}

interface ChequeEnCartera {
  id: string;
  numero_cheque: string;
  banco: string;
  emisor: string;
  monto: number;
  fecha_vencimiento: string;
  estado: string;
}

export default function RegistrarMovimientoProveedorDialog({ open, onOpenChange, proveedorId, onSave }: Props) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    tipo: 'pago' as string,
    numero_comprobante: '',
    tipo_comprobante: '',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '',
    monto: '',
    concepto: '',
    observaciones: '',
    // Payment method fields
    medio_pago: '' as string,
    caja_id: '' as string,
    banco_transferencia: '',
    referencia_transferencia: '',
    // Cheque propio
    cheque_propio_banco: '',
    cheque_propio_numero: '',
    cheque_propio_fecha_emision: new Date().toISOString().split('T')[0],
    cheque_propio_fecha_vencimiento: '',
    // Cheque tercero
    cheque_id: '' as string,
  });
  const [saving, setSaving] = useState(false);
  const [cajasAbiertas, setCajasAbiertas] = useState<Caja[]>([]);
  const [chequesEnCartera, setChequesEnCartera] = useState<ChequeEnCartera[]>([]);

  const isPago = form.tipo === 'pago';

  useEffect(() => {
    if (!open) return;
    // Load open cajas
    const loadCajas = async () => {
      const { data } = await supabase
        .from('cajas')
        .select('id, usuario_id, fecha_apertura, fondo_inicial, estado')
        .eq('estado', 'abierta');
      
      if (data) {
        // Get profile names
        const userIds = [...new Set((data as any[]).map(c => c.usuario_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, nombre')
          .in('id', userIds);
        
        const profileMap = new Map((profiles as any[])?.map(p => [p.id, p.nombre]) || []);
        setCajasAbiertas((data as any[]).map(c => ({
          ...c,
          profile_nombre: profileMap.get(c.usuario_id) || 'Sin nombre',
        })));
      }
    };

    // Load cheques en cartera
    const loadCheques = async () => {
      const { data } = await supabase
        .from('cheques')
        .select('id, numero_cheque, banco, emisor, monto, fecha_vencimiento, estado')
        .eq('estado', 'en_cartera')
        .eq('tipo', 'terceros')
        .order('fecha_vencimiento');
      
      setChequesEnCartera((data as any[]) || []);
    };

    loadCajas();
    loadCheques();
  }, [open]);

  const resetForm = () => {
    setForm({
      tipo: 'pago', numero_comprobante: '', tipo_comprobante: '',
      fecha_emision: new Date().toISOString().split('T')[0], fecha_vencimiento: '',
      monto: '', concepto: '', observaciones: '',
      medio_pago: '', caja_id: '', banco_transferencia: '', referencia_transferencia: '',
      cheque_propio_banco: '', cheque_propio_numero: '',
      cheque_propio_fecha_emision: new Date().toISOString().split('T')[0],
      cheque_propio_fecha_vencimiento: '', cheque_id: '',
    });
  };

  // Auto-fill monto when selecting cheque de tercero
  useEffect(() => {
    if (form.medio_pago === 'cheque_tercero' && form.cheque_id) {
      const cheque = chequesEnCartera.find(c => c.id === form.cheque_id);
      if (cheque) {
        setForm(f => ({ ...f, monto: String(cheque.monto) }));
      }
    }
  }, [form.cheque_id, form.medio_pago, chequesEnCartera]);

  const handleSubmit = async () => {
    const monto = parseFloat(form.monto);
    if (!monto || monto <= 0) return;
    if (isPago && !form.medio_pago) return;

    setSaving(true);

    const baseData: any = {
      proveedor_id: proveedorId,
      tipo: form.tipo,
      numero_comprobante: form.numero_comprobante || null,
      tipo_comprobante: form.tipo_comprobante || null,
      fecha_emision: form.fecha_emision || null,
      fecha_vencimiento: form.fecha_vencimiento || null,
      monto,
      saldo_pendiente: (form.tipo === 'factura' || form.tipo === 'nota_debito') ? monto : 0,
      concepto: form.concepto || null,
      observaciones: form.observaciones || null,
    };

    if (isPago) {
      baseData.medio_pago = form.medio_pago;

      if (form.medio_pago === 'efectivo' && form.caja_id) {
        baseData.caja_id = form.caja_id;
      }

      if (form.medio_pago === 'transferencia') {
        baseData.banco_transferencia = form.banco_transferencia || null;
        baseData.referencia_transferencia = form.referencia_transferencia || null;
      }

      if (form.medio_pago === 'cheque_tercero' && form.cheque_id) {
        baseData.cheque_id = form.cheque_id;
        // Update cheque status to endosado
        await supabase.from('cheques').update({ 
          estado: 'endosado',
          endosado_a: 'Pago a proveedor',
          fecha_endoso: new Date().toISOString(),
        } as any).eq('id', form.cheque_id);

        // Add historial entry
        await supabase.from('cheque_historial').insert({
          cheque_id: form.cheque_id,
          estado_anterior: 'en_cartera',
          estado_nuevo: 'endosado',
          usuario_id: user?.id,
          observaciones: 'Endosado como pago a proveedor',
        } as any);
      }

      if (form.medio_pago === 'cheque_propio') {
        baseData.cheque_propio_banco = form.cheque_propio_banco || null;
        baseData.cheque_propio_numero = form.cheque_propio_numero || null;
        baseData.cheque_propio_fecha_emision = form.cheque_propio_fecha_emision || null;
        baseData.cheque_propio_fecha_vencimiento = form.cheque_propio_fecha_vencimiento || null;
        baseData.cheque_propio_monto = monto;

        // Create cheque in cheques table as emitido
        const { data: nuevoCheque } = await supabase.from('cheques').insert({
          tipo: 'propio',
          numero_cheque: form.cheque_propio_numero,
          banco: form.cheque_propio_banco,
          emisor: 'Empresa',
          beneficiario: null, // Will be linked via proveedor_id in movimiento
          monto,
          fecha_emision: form.cheque_propio_fecha_emision,
          fecha_vencimiento: form.cheque_propio_fecha_vencimiento || form.cheque_propio_fecha_emision,
          estado: 'en_cartera',
          usuario_registro_id: user?.id,
        } as any).select().single();

        if (nuevoCheque) {
          baseData.cheque_id = (nuevoCheque as any).id;
        }
      }
    }

    const ok = await onSave(baseData);
    setSaving(false);
    if (ok) {
      onOpenChange(false);
      resetForm();
    }
  };

  const formatMoney = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);

  const selectedCheque = chequesEnCartera.find(c => c.id === form.cheque_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Registrar Movimiento</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-4">
            {/* Tipo de movimiento */}
            <div>
              <Label>Tipo de Movimiento *</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v, medio_pago: '', caja_id: '', cheque_id: '' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {tipoOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Medio de pago - only for "pago" type */}
            {isPago && (
              <>
                <Separator />
                <div>
                  <Label>Medio de Pago *</Label>
                  <Select value={form.medio_pago} onValueChange={v => setForm(f => ({ ...f, medio_pago: v, caja_id: '', cheque_id: '' }))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar medio de pago" /></SelectTrigger>
                    <SelectContent>
                      {medioPagoOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* EFECTIVO - selector de caja */}
                {form.medio_pago === 'efectivo' && (
                  <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
                    <Label className="text-sm font-semibold">Caja de origen</Label>
                    {cajasAbiertas.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No hay cajas abiertas</p>
                    ) : (
                      <Select value={form.caja_id} onValueChange={v => setForm(f => ({ ...f, caja_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar caja" /></SelectTrigger>
                        <SelectContent>
                          {cajasAbiertas.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.profile_nombre} - Fondo: {formatMoney(c.fondo_inicial)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}

                {/* TRANSFERENCIA - banco y referencia */}
                {form.medio_pago === 'transferencia' && (
                  <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
                    <Label className="text-sm font-semibold">Datos de Transferencia</Label>
                    <div>
                      <Label>Banco origen</Label>
                      <Input value={form.banco_transferencia} onChange={e => setForm(f => ({ ...f, banco_transferencia: e.target.value }))} placeholder="Ej: Banco Nación, Macro..." />
                    </div>
                    <div>
                      <Label>Referencia / Nro. operación</Label>
                      <Input value={form.referencia_transferencia} onChange={e => setForm(f => ({ ...f, referencia_transferencia: e.target.value }))} />
                    </div>
                  </div>
                )}

                {/* CHEQUE PROPIO - datos del cheque a emitir */}
                {form.medio_pago === 'cheque_propio' && (
                  <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
                    <Label className="text-sm font-semibold">Datos del Cheque Propio</Label>
                    <p className="text-xs text-muted-foreground">Se agregará automáticamente al listado de cheques emitidos</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Banco</Label>
                        <Input value={form.cheque_propio_banco} onChange={e => setForm(f => ({ ...f, cheque_propio_banco: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Nro. Cheque</Label>
                        <Input value={form.cheque_propio_numero} onChange={e => setForm(f => ({ ...f, cheque_propio_numero: e.target.value }))} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Fecha Emisión</Label>
                        <Input type="date" value={form.cheque_propio_fecha_emision} onChange={e => setForm(f => ({ ...f, cheque_propio_fecha_emision: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Fecha Vencimiento</Label>
                        <Input type="date" value={form.cheque_propio_fecha_vencimiento} onChange={e => setForm(f => ({ ...f, cheque_propio_fecha_vencimiento: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                )}

                {/* CHEQUE TERCERO - seleccionar de cartera */}
                {form.medio_pago === 'cheque_tercero' && (
                  <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
                    <Label className="text-sm font-semibold">Seleccionar Cheque de Tercero</Label>
                    <p className="text-xs text-muted-foreground">Se endosará automáticamente al proveedor</p>
                    {chequesEnCartera.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No hay cheques de terceros en cartera</p>
                    ) : (
                      <Select value={form.cheque_id} onValueChange={v => setForm(f => ({ ...f, cheque_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar cheque" /></SelectTrigger>
                        <SelectContent>
                          {chequesEnCartera.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              #{c.numero_cheque} - {c.banco} - {formatMoney(c.monto)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {selectedCheque && (
                      <div className="text-xs space-y-1 p-2 bg-background rounded">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Emisor:</span>
                          <span>{selectedCheque.emisor}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Banco:</span>
                          <span>{selectedCheque.banco}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Monto:</span>
                          <span className="font-medium">{formatMoney(selectedCheque.monto)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Vencimiento:</span>
                          <span>{format(new Date(selectedCheque.fecha_vencimiento), 'dd/MM/yyyy', { locale: es })}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <Separator />
              </>
            )}

            {/* Common fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo Comprobante</Label>
                <Input value={form.tipo_comprobante} onChange={e => setForm(f => ({ ...f, tipo_comprobante: e.target.value }))} placeholder="FAC, NC, ND..." />
              </div>
              <div>
                <Label>Nro. Comprobante</Label>
                <Input value={form.numero_comprobante} onChange={e => setForm(f => ({ ...f, numero_comprobante: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha Emisión</Label>
                <Input type="date" value={form.fecha_emision} onChange={e => setForm(f => ({ ...f, fecha_emision: e.target.value }))} />
              </div>
              <div>
                <Label>Fecha Vencimiento</Label>
                <Input type="date" value={form.fecha_vencimiento} onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Monto *</Label>
              <Input
                type="number"
                step="0.01"
                value={form.monto}
                onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                disabled={form.medio_pago === 'cheque_tercero' && !!form.cheque_id}
              />
              {form.medio_pago === 'cheque_tercero' && form.cheque_id && (
                <p className="text-xs text-muted-foreground mt-1">Monto tomado del cheque seleccionado</p>
              )}
            </div>
            <div>
              <Label>Concepto</Label>
              <Input value={form.concepto} onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))} />
            </div>
            <div>
              <Label>Observaciones</Label>
              <Textarea value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} />
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !form.monto || (isPago && !form.medio_pago)}
          >
            {saving ? 'Guardando...' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
