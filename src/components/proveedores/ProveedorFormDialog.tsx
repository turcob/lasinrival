import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Proveedor } from '@/hooks/useProveedores';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proveedor?: Proveedor | null;
  onSave: (data: Partial<Proveedor>) => Promise<boolean>;
}

export default function ProveedorFormDialog({ open, onOpenChange, proveedor, onSave }: Props) {
  const [form, setForm] = useState({
    codigo_proveedor: '',
    razon_social: '',
    contacto: '',
    telefono: '',
    email: '',
    direccion: '',
    cuit: '',
    condicion_iva: '',
    observaciones: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (proveedor) {
      setForm({
        codigo_proveedor: proveedor.codigo_proveedor || '',
        razon_social: proveedor.razon_social || '',
        contacto: proveedor.contacto || '',
        telefono: proveedor.telefono || '',
        email: proveedor.email || '',
        direccion: proveedor.direccion || '',
        cuit: proveedor.cuit || '',
        condicion_iva: proveedor.condicion_iva || '',
        observaciones: proveedor.observaciones || '',
      });
    } else {
      setForm({ codigo_proveedor: '', razon_social: '', contacto: '', telefono: '', email: '', direccion: '', cuit: '', condicion_iva: '', observaciones: '' });
    }
  }, [proveedor, open]);

  const handleSubmit = async () => {
    if (!form.razon_social.trim()) return;
    setSaving(true);
    const ok = await onSave(form);
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{proveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Código</Label>
            <Input value={form.codigo_proveedor} onChange={e => setForm(f => ({ ...f, codigo_proveedor: e.target.value }))} />
          </div>
          <div>
            <Label>CUIT</Label>
            <Input value={form.cuit} onChange={e => setForm(f => ({ ...f, cuit: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <Label>Razón Social *</Label>
            <Input value={form.razon_social} onChange={e => setForm(f => ({ ...f, razon_social: e.target.value }))} />
          </div>
          <div>
            <Label>Contacto</Label>
            <Input value={form.contacto} onChange={e => setForm(f => ({ ...f, contacto: e.target.value }))} />
          </div>
          <div>
            <Label>Teléfono</Label>
            <Input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <Label>Condición IVA</Label>
            <Input value={form.condicion_iva} onChange={e => setForm(f => ({ ...f, condicion_iva: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <Label>Dirección</Label>
            <Input value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <Label>Observaciones</Label>
            <Textarea value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !form.razon_social.trim()}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
