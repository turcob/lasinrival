import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

export default function RegistrarMovimientoProveedorDialog({ open, onOpenChange, proveedorId, onSave }: Props) {
  const [form, setForm] = useState({
    tipo: 'pago' as string,
    numero_comprobante: '',
    tipo_comprobante: '',
    fecha_emision: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '',
    monto: '',
    concepto: '',
    observaciones: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const monto = parseFloat(form.monto);
    if (!monto || monto <= 0) return;

    setSaving(true);
    const ok = await onSave({
      proveedor_id: proveedorId,
      tipo: form.tipo,
      numero_comprobante: form.numero_comprobante || null,
      tipo_comprobante: form.tipo_comprobante || null,
      fecha_emision: form.fecha_emision || null,
      fecha_vencimiento: form.fecha_vencimiento || null,
      monto,
      saldo_pendiente: form.tipo === 'factura' || form.tipo === 'nota_debito' ? monto : 0,
      concepto: form.concepto || null,
      observaciones: form.observaciones || null,
    });
    setSaving(false);
    if (ok) {
      onOpenChange(false);
      setForm({ tipo: 'pago', numero_comprobante: '', tipo_comprobante: '', fecha_emision: new Date().toISOString().split('T')[0], fecha_vencimiento: '', monto: '', concepto: '', observaciones: '' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Movimiento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Tipo *</Label>
            <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {tipoOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
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
            <Input type="number" step="0.01" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} />
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
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !form.monto}>
            {saving ? 'Guardando...' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
