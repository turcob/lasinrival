import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import type { Proveedor } from '@/hooks/useProveedores';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proveedores: Proveedor[];
  onSave: (orden: any, detalles: any[]) => Promise<boolean>;
}

interface LineaDetalle {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
}

export default function NuevaOrdenCompraDialog({ open, onOpenChange, proveedores, onSave }: Props) {
  const [proveedorId, setProveedorId] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [lineas, setLineas] = useState<LineaDetalle[]>([{ descripcion: '', cantidad: 1, precio_unitario: 0 }]);
  const [saving, setSaving] = useState(false);

  const addLinea = () => setLineas(l => [...l, { descripcion: '', cantidad: 1, precio_unitario: 0 }]);
  const removeLinea = (i: number) => setLineas(l => l.filter((_, idx) => idx !== i));
  const updateLinea = (i: number, field: keyof LineaDetalle, value: any) => {
    setLineas(l => l.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  };

  const subtotal = lineas.reduce((a, l) => a + l.cantidad * l.precio_unitario, 0);
  const formatMoney = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);

  const handleSubmit = async () => {
    if (!proveedorId || lineas.length === 0) return;
    setSaving(true);

    const detalles = lineas.filter(l => l.descripcion).map(l => ({
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precio_unitario: l.precio_unitario,
      subtotal: l.cantidad * l.precio_unitario,
    }));

    const ok = await onSave({
      proveedor_id: proveedorId,
      fecha_entrega_estimada: fechaEntrega || null,
      subtotal,
      total: subtotal,
      observaciones: observaciones || null,
    }, detalles);

    setSaving(false);
    if (ok) {
      onOpenChange(false);
      setProveedorId('');
      setFechaEntrega('');
      setObservaciones('');
      setLineas([{ descripcion: '', cantidad: 1, precio_unitario: 0 }]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Orden de Compra</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Proveedor *</Label>
              <Select value={proveedorId} onValueChange={setProveedorId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar proveedor" /></SelectTrigger>
                <SelectContent>
                  {proveedores.filter(p => p.activo).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.razon_social}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha Entrega Estimada</Label>
              <Input type="date" value={fechaEntrega} onChange={e => setFechaEntrega(e.target.value)} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Detalle</Label>
              <Button size="sm" variant="outline" onClick={addLinea}><Plus className="h-3 w-3 mr-1" /> Línea</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="w-24">Cantidad</TableHead>
                  <TableHead className="w-32">Precio Unit.</TableHead>
                  <TableHead className="w-32 text-right">Subtotal</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineas.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Input value={l.descripcion} onChange={e => updateLinea(i, 'descripcion', e.target.value)} placeholder="Producto / Concepto" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={l.cantidad} onChange={e => updateLinea(i, 'cantidad', parseFloat(e.target.value) || 0)} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.01" value={l.precio_unitario} onChange={e => updateLinea(i, 'precio_unitario', parseFloat(e.target.value) || 0)} />
                    </TableCell>
                    <TableCell className="text-right">{formatMoney(l.cantidad * l.precio_unitario)}</TableCell>
                    <TableCell>
                      {lineas.length > 1 && (
                        <Button size="icon" variant="ghost" onClick={() => removeLinea(i)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="text-right mt-2 font-bold text-lg">Total: {formatMoney(subtotal)}</div>
          </div>

          <div>
            <Label>Observaciones</Label>
            <Textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !proveedorId}>
            {saving ? 'Guardando...' : 'Crear Orden'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
