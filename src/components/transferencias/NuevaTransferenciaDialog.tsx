import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCrearTransferencia } from '@/hooks/useTransferencias';
import { toast } from 'sonner';

interface Cliente { id: string; nombre: string; dni_cuit: string | null }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function NuevaTransferenciaDialog({ open, onOpenChange }: Props) {
  const crear = useCrearTransferencia();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState<string>('');
  const [openCli, setOpenCli] = useState(false);
  const [titularNombre, setTitularNombre] = useState('');
  const [titularCuil, setTitularCuil] = useState('');
  const [numeroOperacion, setNumeroOperacion] = useState('');
  const [importe, setImporte] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!open) return;
    supabase.from('clientes').select('id,nombre,dni_cuit').eq('activo', true).order('nombre').limit(1000)
      .then(({ data }) => setClientes((data || []) as Cliente[]));
  }, [open]);

  const reset = () => {
    setClienteId(''); setTitularNombre(''); setTitularCuil('');
    setNumeroOperacion(''); setImporte(''); setFecha(new Date().toISOString().slice(0, 10));
  };

  const handleSubmit = async () => {
    if (!clienteId) return toast.error('Seleccione un cliente');
    if (!titularNombre.trim()) return toast.error('Indique el titular');
    const monto = parseFloat(importe.replace(',', '.'));
    if (!monto || monto <= 0) return toast.error('Importe inválido');
    await crear.mutateAsync({
      fecha_transferencia: fecha,
      cliente_id: clienteId,
      titular_nombre: titularNombre.trim(),
      titular_cuil: titularCuil.trim() || null,
      numero_operacion: numeroOperacion.trim() || null,
      importe: monto,
    });
    reset();
    onOpenChange(false);
  };

  const clienteSel = clientes.find(c => c.id === clienteId);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva Transferencia</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Cliente *</Label>
            <Popover open={openCli} onOpenChange={setOpenCli}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between">
                  {clienteSel ? clienteSel.nombre : 'Seleccionar cliente'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput placeholder="Buscar cliente..." />
                  <CommandList>
                    <CommandEmpty>Sin resultados</CommandEmpty>
                    <CommandGroup>
                      {clientes.map(c => (
                        <CommandItem key={c.id} value={`${c.nombre} ${c.dni_cuit || ''}`} onSelect={() => { setClienteId(c.id); setOpenCli(false); }}>
                          <Check className={cn('mr-2 h-4 w-4', clienteId === c.id ? 'opacity-100' : 'opacity-0')} />
                          {c.nombre} {c.dni_cuit && <span className="ml-2 text-xs text-muted-foreground">{c.dni_cuit}</span>}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fecha *</Label>
              <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
            <div>
              <Label>Importe *</Label>
              <Input value={importe} onChange={e => setImporte(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div>
            <Label>Titular *</Label>
            <Input value={titularNombre} onChange={e => setTitularNombre(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>CUIL / CUIT</Label>
              <Input value={titularCuil} onChange={e => setTitularCuil(e.target.value)} />
            </div>
            <div>
              <Label>Nº de Operación</Label>
              <Input value={numeroOperacion} onChange={e => setNumeroOperacion(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={crear.isPending}>Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}