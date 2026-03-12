import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ChequeTipo } from '@/hooks/useCheques';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
}

export function NuevoChequeDialog({ open, onOpenChange, onSubmit }: Props) {
  const { user } = useAuth();
  const [clientes, setClientes] = useState<{ id: string; nombre: string }[]>([]);
  const [form, setForm] = useState({
    tipo: 'terceros' as ChequeTipo,
    numero_cheque: '',
    banco: '',
    sucursal_banco: '',
    emisor: '',
    cuit_emisor: '',
    beneficiario: '',
    cliente_id: '',
    monto: '',
    fecha_emision: '',
    fecha_vencimiento: '',
    observaciones: '',
  });

  useEffect(() => {
    if (open) {
      supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre').then(({ data }) => {
        setClientes(data || []);
      });
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...form,
      monto: parseFloat(form.monto),
      cliente_id: form.cliente_id || null,
      sucursal_banco: form.sucursal_banco || null,
      cuit_emisor: form.cuit_emisor || null,
      beneficiario: form.beneficiario || null,
      observaciones: form.observaciones || null,
      estado: 'en_cartera',
      usuario_registro_id: user!.id,
    });
    setForm({
      tipo: 'terceros', numero_cheque: '', banco: '', sucursal_banco: '', emisor: '', cuit_emisor: '',
      beneficiario: '', cliente_id: '', monto: '', fecha_emision: '', fecha_vencimiento: '', observaciones: '',
    });
    onOpenChange(false);
  };

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Cheque</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => update('tipo', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="terceros">De Terceros</SelectItem>
                  <SelectItem value="propio">Propio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nº Cheque *</Label>
              <Input required value={form.numero_cheque} onChange={e => update('numero_cheque', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Banco *</Label>
              <Input required value={form.banco} onChange={e => update('banco', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sucursal Banco</Label>
              <Input value={form.sucursal_banco} onChange={e => update('sucursal_banco', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Emisor *</Label>
              <Input required value={form.emisor} onChange={e => update('emisor', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>CUIT Emisor</Label>
              <Input value={form.cuit_emisor} onChange={e => update('cuit_emisor', e.target.value)} />
            </div>
            {form.tipo === 'propio' && (
              <div className="space-y-2">
                <Label>Beneficiario</Label>
                <Input value={form.beneficiario} onChange={e => update('beneficiario', e.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={form.cliente_id} onValueChange={v => update('cliente_id', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {clientes.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Monto *</Label>
              <Input required type="number" step="0.01" min="0" value={form.monto} onChange={e => update('monto', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fecha Emisión *</Label>
              <Input required type="date" value={form.fecha_emision} onChange={e => update('fecha_emision', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fecha Vencimiento *</Label>
              <Input required type="date" value={form.fecha_vencimiento} onChange={e => update('fecha_vencimiento', e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea value={form.observaciones} onChange={e => update('observaciones', e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">Registrar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
