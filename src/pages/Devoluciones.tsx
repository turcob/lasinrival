import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useDevolucionesManuales, useCrearDevolucionManual } from '@/hooks/useNotasCredito';
import { format } from 'date-fns';

const MOTIVOS = [
  { value: 'producto_vencido', label: 'Producto vencido' },
  { value: 'producto_roto', label: 'Producto dañado/roto' },
  { value: 'cambio', label: 'Cambio por otro producto' },
  { value: 'no_satisfecho', label: 'Cliente no satisfecho' },
  { value: 'otro', label: 'Otro motivo' },
];

export default function Devoluciones() {
  const [tab, setTab] = useState('nueva');
  const [filtro, setFiltro] = useState('');

  // Form state
  const [productoId, setProductoId] = useState<string>('');
  const [productoOpen, setProductoOpen] = useState(false);
  const [productoSearch, setProductoSearch] = useState('');
  const [clienteId, setClienteId] = useState<string>('');
  const [clienteOpen, setClienteOpen] = useState(false);
  const [clienteSearch, setClienteSearch] = useState('');
  const [cantidad, setCantidad] = useState<string>('1');
  const [precio, setPrecio] = useState<string>('0');
  const [motivo, setMotivo] = useState<string>('');
  const [detalle, setDetalle] = useState<string>('');
  const [generarNC, setGenerarNC] = useState(true);
  const [reingresarStock, setReingresarStock] = useState(true);
  const [observaciones, setObservaciones] = useState('');

  const crearDev = useCrearDevolucionManual();
  const { data: devoluciones = [], isLoading } = useDevolucionesManuales();

  // Buscar productos
  const { data: productos = [] } = useQuery({
    queryKey: ['productos-devolucion-search', productoSearch],
    queryFn: async () => {
      let q = supabase
        .from('productos')
        .select('id, codigo_articulo, descripcion, precio_costo, stock_actual')
        .eq('activo', true)
        .limit(30);
      if (productoSearch) {
        q = q.or(`descripcion.ilike.%${productoSearch}%,codigo_articulo.ilike.%${productoSearch}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar clientes
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-devolucion-search', clienteSearch],
    queryFn: async () => {
      let q = supabase
        .from('clientes')
        .select('id, nombre, codigo_cliente')
        .eq('activo', true)
        .limit(30);
      if (clienteSearch) {
        q = q.or(`nombre.ilike.%${clienteSearch}%,codigo_cliente.ilike.%${clienteSearch}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const productoSel = productos.find((p: any) => p.id === productoId);
  const clienteSel = clientes.find((c: any) => c.id === clienteId);

  const handleSubmit = async () => {
    if (!productoId || !clienteId || !motivo) return;
    await crearDev.mutateAsync({
      cliente_id: clienteId,
      producto_id: productoId,
      cantidad: Number(cantidad),
      precio_unitario: Number(precio),
      motivo,
      detalle_motivo: detalle || undefined,
      generar_nc: generarNC,
      reingresar_stock: reingresarStock,
      observaciones: observaciones || undefined,
    });
    // Reset form
    setProductoId('');
    setClienteId('');
    setCantidad('1');
    setPrecio('0');
    setMotivo('');
    setDetalle('');
    setObservaciones('');
    setTab('listado');
  };

  const devolucionesFiltradas = useMemo(() => {
    if (!filtro) return devoluciones;
    const f = filtro.toLowerCase();
    return devoluciones.filter((d: any) =>
      d.cliente?.nombre?.toLowerCase().includes(f) ||
      d.producto?.descripcion?.toLowerCase().includes(f) ||
      d.producto?.codigo_articulo?.toLowerCase().includes(f)
    );
  }, [devoluciones, filtro]);

  const importeTotal = Number(cantidad) * Number(precio);

  return (
    <MainLayout>
      <PageHeader
        title="Devoluciones"
        description="Registrar productos devueltos por clientes (fuera de pedido). Genera NC pendiente de aprobación."
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="nueva">
            <Plus className="h-4 w-4 mr-1" /> Nueva devolución
          </TabsTrigger>
          <TabsTrigger value="listado">
            Listado ({devoluciones.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nueva">
          <Card>
            <CardHeader>
              <CardTitle>Registrar devolución manual</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Producto */}
              <div className="space-y-2">
                <Label>Producto *</Label>
                <Popover open={productoOpen} onOpenChange={setProductoOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between">
                      {productoSel
                        ? `${productoSel.codigo_articulo} - ${productoSel.descripcion}`
                        : 'Buscar producto...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[600px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Buscar por código o descripción..."
                        value={productoSearch}
                        onValueChange={setProductoSearch}
                      />
                      <CommandList>
                        <CommandEmpty>Sin resultados</CommandEmpty>
                        <CommandGroup>
                          {productos.map((p: any) => (
                            <CommandItem
                              key={p.id}
                              value={p.id}
                              onSelect={() => {
                                setProductoId(p.id);
                                setPrecio(String(p.precio_costo || 0));
                                setProductoOpen(false);
                              }}
                            >
                              <Check className={cn('mr-2 h-4 w-4', productoId === p.id ? 'opacity-100' : 'opacity-0')} />
                              <span className="font-mono text-xs mr-2">{p.codigo_articulo}</span>
                              <span className="flex-1">{p.descripcion}</span>
                              <span className="text-muted-foreground text-xs">Costo: ${Number(p.precio_costo || 0).toLocaleString('es-AR')}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Cliente */}
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <Popover open={clienteOpen} onOpenChange={setClienteOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between">
                      {clienteSel ? `${clienteSel.codigo_cliente || ''} - ${clienteSel.nombre}` : 'Buscar cliente...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[600px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Buscar por código o nombre..."
                        value={clienteSearch}
                        onValueChange={setClienteSearch}
                      />
                      <CommandList>
                        <CommandEmpty>Sin resultados</CommandEmpty>
                        <CommandGroup>
                          {clientes.map((c: any) => (
                            <CommandItem
                              key={c.id}
                              value={c.id}
                              onSelect={() => {
                                setClienteId(c.id);
                                setClienteOpen(false);
                              }}
                            >
                              <Check className={cn('mr-2 h-4 w-4', clienteId === c.id ? 'opacity-100' : 'opacity-0')} />
                              <span className="font-mono text-xs mr-2">{c.codigo_cliente || '-'}</span>
                              <span>{c.nombre}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Cantidad *</Label>
                  <Input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Precio unitario</Label>
                  <Input type="number" min="0" step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Importe total</Label>
                  <Input value={`$${importeTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`} readOnly className="font-bold" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Motivo *</Label>
                <Select value={motivo} onValueChange={setMotivo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOTIVOS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Detalle adicional (opcional)</Label>
                <Textarea value={detalle} onChange={(e) => setDetalle(e.target.value)} rows={2} />
              </div>

              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Checkbox id="generar-nc" checked={generarNC} onCheckedChange={(v) => setGenerarNC(v === true)} />
                  <Label htmlFor="generar-nc" className="cursor-pointer">
                    Generar Nota de Crédito (queda pendiente de aprobación)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="reingresar" checked={reingresarStock} onCheckedChange={(v) => setReingresarStock(v === true)} />
                  <Label htmlFor="reingresar" className="cursor-pointer">
                    Sugerir reingreso al stock (admin decide al aprobar)
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observaciones</Label>
                <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} />
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSubmit}
                  disabled={!productoId || !clienteId || !motivo || crearDev.isPending}
                >
                  {crearDev.isPending ? 'Guardando...' : 'Registrar devolución'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="listado">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Devoluciones registradas</span>
                <div className="relative w-72">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    className="pl-8"
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                  />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-center">Cantidad</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>NC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow><TableCell colSpan={7} className="text-center">Cargando...</TableCell></TableRow>
                  )}
                  {!isLoading && devolucionesFiltradas.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sin devoluciones</TableCell></TableRow>
                  )}
                  {devolucionesFiltradas.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="text-sm">{format(new Date(d.fecha), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>{d.cliente?.nombre || '-'}</TableCell>
                      <TableCell className="text-sm">
                        <span className="font-mono text-xs text-muted-foreground mr-2">{d.producto?.codigo_articulo}</span>
                        {d.producto?.descripcion}
                      </TableCell>
                      <TableCell className="text-center font-medium">{d.cantidad}</TableCell>
                      <TableCell className="text-right font-bold">
                        ${Number(d.importe_total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell><Badge variant="outline">{d.motivo}</Badge></TableCell>
                      <TableCell>
                        {d.generar_nc ? (
                          <Badge>NC pendiente</Badge>
                        ) : (
                          <Badge variant="secondary">Sin NC</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
