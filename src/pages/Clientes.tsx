import { useEffect, useState, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit2, Trash2, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MapPin, User, Wallet, FileSpreadsheet, ShieldAlert, ShieldCheck } from 'lucide-react';
import { ExcelImporterClientes } from '@/components/clientes/ExcelImporterClientes';
import { ExcelImporterCuentaCorriente } from '@/components/clientes/ExcelImporterCuentaCorriente';
import { ImportarDeudasDialog } from '@/components/clientes/ImportarDeudasDialog';
import { ImportarHistorialDialog } from '@/components/clientes/ImportarHistorialDialog';
import { CuentaCorrienteClienteDialog } from '@/components/clientes/CuentaCorrienteClienteDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Cliente {
  id: string;
  codigo_cliente: string | null;
  nombre: string;
  dni_cuit: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  lista_precio_id: string | null;
  zona_id: string | null;
  vendedor_id: string | null;
  activo: boolean;
  bloqueado: boolean;
  facturas_adeudadas_bloqueo_override: number | null;
  listas_precios?: { nombre: string } | null;
  zonas?: { codigo: string; nombre: string } | null;
  vendedores?: { codigo: string; nombre: string } | null;
}

interface ListaPrecio {
  id: string;
  nombre: string;
}

interface Zona {
  id: string;
  codigo: string;
  nombre: string;
}

interface Vendedor {
  id: string;
  codigo: string;
  nombre: string;
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [listasPrecios, setListasPrecios] = useState<ListaPrecio[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [ccDialogOpen, setCcDialogOpen] = useState(false);
  const [ccCliente, setCcCliente] = useState<Cliente | null>(null);
  const [importDeudasOpen, setImportDeudasOpen] = useState(false);
  const [importHistorialOpen, setImportHistorialOpen] = useState(false);
  const [clienteSaldos, setClienteSaldos] = useState<Record<string, number>>({});
  const [clienteFacturasAdeudadas, setClienteFacturasAdeudadas] = useState<Record<string, number>>({});
  const [bloqueoConfig, setBloqueoConfig] = useState<{ facturas_adeudadas_bloqueo: number; bloqueo_automatico_activo: boolean }>({ facturas_adeudadas_bloqueo: 3, bloqueo_automatico_activo: true });
  const [formData, setFormData] = useState({
    codigo_cliente: '',
    nombre: '',
    dni_cuit: '',
    telefono: '',
    email: '',
    direccion: '',
    lista_precio_id: '',
    zona_id: '',
    vendedor_id: '',
    numero_terminal_clover: '',
    activo: true,
    facturas_adeudadas_bloqueo_override: '',
  });

  // Filters
  const [filterZona, setFilterZona] = useState<string>('all');
  const [filterVendedor, setFilterVendedor] = useState<string>('all');

  // Server-side pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchCatalogs();
  }, []);

  useEffect(() => {
    fetchClientes();
  }, [currentPage, pageSize, debouncedSearch, filterZona, filterVendedor]);

  const fetchCatalogs = async () => {
    const [listasRes, zonasRes, vendedoresRes, configRes] = await Promise.all([
      supabase.from('listas_precios').select('id, nombre').eq('activo', true),
      supabase.from('zonas').select('id, codigo, nombre').eq('activo', true).order('codigo'),
      supabase.from('vendedores').select('id, codigo, nombre').eq('activo', true).order('nombre'),
      supabase.from('configuracion_comercio').select('facturas_adeudadas_bloqueo, bloqueo_automatico_activo').limit(1).maybeSingle(),
    ]);
    if (listasRes.data) setListasPrecios(listasRes.data);
    if (zonasRes.data) setZonas(zonasRes.data);
    if (vendedoresRes.data) setVendedores(vendedoresRes.data);
    if (configRes.data) setBloqueoConfig({
      facturas_adeudadas_bloqueo: (configRes.data as any).facturas_adeudadas_bloqueo ?? 3,
      bloqueo_automatico_activo: (configRes.data as any).bloqueo_automatico_activo ?? true,
    });
  };

  const fetchClientes = useCallback(async () => {
    setLoading(true);
    try {
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('clientes')
        .select('*, listas_precios(nombre), zonas(codigo, nombre), vendedores(codigo, nombre)', { count: 'exact' });

      // Apply search filter
      if (debouncedSearch) {
        query = query.or(
          `nombre.ilike.%${debouncedSearch}%,dni_cuit.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%,telefono.ilike.%${debouncedSearch}%,codigo_cliente.ilike.%${debouncedSearch}%`
        );
      }

      // Apply zone filter
      if (filterZona && filterZona !== 'all') {
        query = query.eq('zona_id', filterZona);
      }

      // Apply vendor filter
      if (filterVendedor && filterVendedor !== 'all') {
        query = query.eq('vendedor_id', filterVendedor);
      }

      const { data, count, error } = await query
        .order('nombre')
        .range(from, to);

      if (error) throw error;
      
      setClientes(data || []);
      setTotalCount(count || 0);

      // Fetch saldos for all clients in this page
      if (data && data.length > 0) {
        const clienteIds = data.map(c => c.id);
        const { data: saldosData } = await supabase
          .from('cliente_saldos')
          .select('cliente_id, saldo_actual')
          .in('cliente_id', clienteIds);
        
        if (saldosData) {
          const saldosMap: Record<string, number> = {};
          saldosData.forEach(s => {
            saldosMap[s.cliente_id] = Number(s.saldo_actual) || 0;
          });
          setClienteSaldos(saldosMap);
        }
      }
    } catch (error) {
      console.error('Error fetching clientes:', error);
      toast.error('Error al cargar los clientes');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, debouncedSearch, filterZona, filterVendedor]);

  const fetchData = () => {
    fetchClientes();
    fetchCatalogs();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const data = {
        ...formData,
        codigo_cliente: formData.codigo_cliente || null,
        dni_cuit: formData.dni_cuit || null,
        telefono: formData.telefono || null,
        email: formData.email || null,
        direccion: formData.direccion || null,
        lista_precio_id: formData.lista_precio_id || null,
        zona_id: formData.zona_id || null,
        vendedor_id: formData.vendedor_id || null,
        numero_terminal_clover: formData.numero_terminal_clover || null,
        facturas_adeudadas_bloqueo_override: formData.facturas_adeudadas_bloqueo_override ? parseInt(formData.facturas_adeudadas_bloqueo_override) : null,
      };

      if (selectedCliente) {
        const { error } = await supabase
          .from('clientes')
          .update(data)
          .eq('id', selectedCliente.id);
        
        if (error) throw error;
        toast.success('Cliente actualizado correctamente');
      } else {
        const { error } = await supabase.from('clientes').insert([data]);
        if (error) throw error;
        toast.success('Cliente creado correctamente');
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving cliente:', error);
      toast.error('Error al guardar el cliente');
    }
  };

  const handleDelete = async () => {
    if (!selectedCliente) return;

    try {
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', selectedCliente.id);

      if (error) throw error;
      toast.success('Cliente eliminado correctamente');
      setDeleteDialogOpen(false);
      setSelectedCliente(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting cliente:', error);
      toast.error('Error al eliminar el cliente');
    }
  };

  const openEditDialog = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setFormData({
      codigo_cliente: cliente.codigo_cliente || '',
      nombre: cliente.nombre,
      dni_cuit: cliente.dni_cuit || '',
      telefono: cliente.telefono || '',
      email: cliente.email || '',
      direccion: cliente.direccion || '',
      lista_precio_id: cliente.lista_precio_id || '',
      zona_id: cliente.zona_id || '',
      vendedor_id: cliente.vendedor_id || '',
      numero_terminal_clover: (cliente as any).numero_terminal_clover || '',
      activo: cliente.activo,
      facturas_adeudadas_bloqueo_override: cliente.facturas_adeudadas_bloqueo_override?.toString() || '',
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setSelectedCliente(null);
    setFormData({
      codigo_cliente: '',
      nombre: '',
      dni_cuit: '',
      telefono: '',
      email: '',
      direccion: '',
      lista_precio_id: '',
      zona_id: '',
      vendedor_id: '',
      numero_terminal_clover: '',
      activo: true,
    });
  };

  const totalPages = Math.ceil(totalCount / pageSize);
  const startIndex = (currentPage - 1) * pageSize;

  return (
    <MainLayout>
      <PageHeader title="Clientes" description="Gestión de clientes">
        <div className="flex flex-wrap gap-2">
          <ExcelImporterClientes onImportComplete={fetchData} />
          <ExcelImporterCuentaCorriente onImportComplete={fetchData} />
          <Button variant="outline" onClick={() => setImportDeudasOpen(true)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Importar Deudas
          </Button>
          <Button variant="outline" onClick={() => setImportHistorialOpen(true)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Importar Historial
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Cliente
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selectedCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="codigo_cliente">Código de Cliente</Label>
                  <Input
                    id="codigo_cliente"
                    value={formData.codigo_cliente}
                    onChange={(e) =>
                      setFormData({ ...formData, codigo_cliente: e.target.value })
                    }
                    placeholder="Ej: 000001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre / Razón Social *</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) =>
                      setFormData({ ...formData, nombre: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dni_cuit">DNI/CUIT</Label>
                  <Input
                    id="dni_cuit"
                    value={formData.dni_cuit}
                    onChange={(e) =>
                      setFormData({ ...formData, dni_cuit: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input
                    id="telefono"
                    value={formData.telefono}
                    onChange={(e) =>
                      setFormData({ ...formData, telefono: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lista_precio">Lista de Precio</Label>
                  <Select
                    value={formData.lista_precio_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, lista_precio_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Por defecto" />
                    </SelectTrigger>
                    <SelectContent>
                      {listasPrecios.map((lista) => (
                        <SelectItem key={lista.id} value={lista.id}>
                          {lista.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="zona">Zona</Label>
                  <Select
                    value={formData.zona_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, zona_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin zona" />
                    </SelectTrigger>
                    <SelectContent>
                      {zonas.map((zona) => (
                        <SelectItem key={zona.id} value={zona.id}>
                          {zona.codigo} - {zona.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vendedor">Vendedor</Label>
                  <Select
                    value={formData.vendedor_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, vendedor_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin vendedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendedores.map((vendedor) => (
                        <SelectItem key={vendedor.id} value={vendedor.id}>
                          {vendedor.codigo} - {vendedor.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="direccion">Dirección</Label>
                  <Input
                    id="direccion"
                    value={formData.direccion}
                    onChange={(e) =>
                      setFormData({ ...formData, direccion: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numero_terminal_clover">Nº Terminal Clover</Label>
                  <Input
                    id="numero_terminal_clover"
                    value={formData.numero_terminal_clover}
                    onChange={(e) =>
                      setFormData({ ...formData, numero_terminal_clover: e.target.value })
                    }
                    placeholder="Ej: 69404603"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="activo"
                  checked={formData.activo}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, activo: checked })
                  }
                />
                <Label htmlFor="activo">Cliente activo</Label>
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {selectedCliente ? 'Guardar Cambios' : 'Crear Cliente'}
                </Button>
              </div>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      {/* Custom server-side paginated table */}
      <div className="space-y-4">
        {/* Search and filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar clientes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={filterZona}
              onValueChange={(value) => {
                setFilterZona(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-48">
                <MapPin className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Todas las zonas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las zonas</SelectItem>
                {zonas.map((zona) => (
                  <SelectItem key={zona.id} value={zona.id}>
                    {zona.codigo} - {zona.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filterVendedor}
              onValueChange={(value) => {
                setFilterVendedor(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-48">
                <User className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Todos los vendedores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los vendedores</SelectItem>
                {vendedores.map((vendedor) => (
                  <SelectItem key={vendedor.id} value={vendedor.id}>
                    {vendedor.codigo} - {vendedor.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Mostrar</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">registros</span>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold w-24">Código</TableHead>
                <TableHead className="font-semibold">Nombre / Razón Social</TableHead>
                <TableHead className="font-semibold">DNI/CUIT</TableHead>
                <TableHead className="font-semibold">Teléfono</TableHead>
                <TableHead className="font-semibold">Zona</TableHead>
                <TableHead className="font-semibold">Vendedor</TableHead>
                <TableHead className="font-semibold">Saldo CC</TableHead>
                <TableHead className="font-semibold">Estado</TableHead>
                <TableHead className="font-semibold">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center">
                    <div className="flex items-center justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : clientes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                    No se encontraron clientes
                  </TableCell>
                </TableRow>
              ) : (
                clientes.map((cliente) => {
                  const saldo = clienteSaldos[cliente.id] || 0;
                  return (
                  <TableRow key={cliente.id} className="table-row-hover">
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {cliente.codigo_cliente || '-'}
                      </code>
                    </TableCell>
                    <TableCell className="font-medium">{cliente.nombre}</TableCell>
                    <TableCell>{cliente.dni_cuit || '-'}</TableCell>
                    <TableCell>{cliente.telefono || '-'}</TableCell>
                    <TableCell>
                      {cliente.zonas ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="outline" className="text-xs">
                                {cliente.zonas.codigo}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              {cliente.zonas.nombre}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {cliente.vendedores ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="secondary" className="text-xs">
                                {cliente.vendedores.codigo}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              {cliente.vendedores.nombre}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <span className={`font-medium ${saldo > 0 ? 'text-destructive' : saldo < 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {saldo !== 0 ? `$${saldo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-'}
                      </span>
                    </TableCell>
                    <TableCell><StatusBadge status={cliente.activo} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => {
                                  setCcCliente(cliente);
                                  setCcDialogOpen(true);
                                }}
                              >
                                <Wallet className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Ver Cuenta Corriente</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(cliente)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedCliente(cliente);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {totalCount === 0 ? 0 : startIndex + 1} a {Math.min(startIndex + pageSize, totalCount)} de{' '}
            {totalCount} clientes
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-4 text-sm">
              Página {currentPage} de {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage >= totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el cliente
              {selectedCliente && ` "${selectedCliente.nombre}"`}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cuenta Corriente Dialog */}
      {ccCliente && (
        <CuentaCorrienteClienteDialog
          open={ccDialogOpen}
          onOpenChange={setCcDialogOpen}
          cliente={ccCliente}
          onMovimientoRegistrado={fetchClientes}
        />
      )}

      {/* Importar Deudas Dialog */}
      <ImportarDeudasDialog
        open={importDeudasOpen}
        onOpenChange={setImportDeudasOpen}
        onImportComplete={fetchData}
      />

      {/* Importar Historial Dialog */}
      <ImportarHistorialDialog
        open={importHistorialOpen}
        onOpenChange={setImportHistorialOpen}
        onImportComplete={fetchData}
      />
    </MainLayout>
  );
}
