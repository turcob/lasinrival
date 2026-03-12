import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { KPICard } from '@/components/shared/KPICard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useProveedores, useOrdenesCompra } from '@/hooks/useProveedores';
import ProveedorFormDialog from '@/components/proveedores/ProveedorFormDialog';
import ImportarProveedoresDialog from '@/components/proveedores/ImportarProveedoresDialog';
import ImportarCuentaCorrienteDialog from '@/components/proveedores/ImportarCuentaCorrienteDialog';
import CuentaCorrienteProveedorDialog from '@/components/proveedores/CuentaCorrienteProveedorDialog';
import NuevaOrdenCompraDialog from '@/components/proveedores/NuevaOrdenCompraDialog';
import type { Proveedor } from '@/hooks/useProveedores';
import {
  Plus, Search, Upload, FileSpreadsheet, MoreHorizontal, Edit, Trash2,
  Eye, ShoppingCart, Users, TrendingDown, Package, ClipboardList, DollarSign
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const estadoOrdenColors: Record<string, string> = {
  borrador: 'bg-muted text-muted-foreground',
  confirmada: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  parcial: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  recibida: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  anulada: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export default function Proveedores() {
  const { proveedores, loading, fetchProveedores, crearProveedor, actualizarProveedor, eliminarProveedor } = useProveedores();
  const { ordenes, loading: loadingOrdenes, crearOrden, actualizarEstado } = useOrdenesCompra();

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProv, setEditingProv] = useState<Proveedor | null>(null);
  const [showImportar, setShowImportar] = useState(false);
  const [showImportarCC, setShowImportarCC] = useState(false);
  const [showCC, setShowCC] = useState(false);
  const [selectedProv, setSelectedProv] = useState<Proveedor | null>(null);
  const [showNuevaOrden, setShowNuevaOrden] = useState(false);

  const filtered = useMemo(() =>
    proveedores.filter(p =>
      p.razon_social.toLowerCase().includes(search.toLowerCase()) ||
      p.codigo_proveedor.toLowerCase().includes(search.toLowerCase()) ||
      (p.cuit || '').toLowerCase().includes(search.toLowerCase())
    ), [proveedores, search]);

  const formatMoney = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);
  const formatDate = (d: string | null) => d ? format(new Date(d), 'dd/MM/yyyy', { locale: es }) : '-';

  const handleSave = async (data: Partial<Proveedor>) => {
    if (editingProv) return actualizarProveedor(editingProv.id, data);
    return crearProveedor(data);
  };

  return (
    <MainLayout>
      <PageHeader title="Proveedores" description="Gestión integral de proveedores, compras y pagos" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <KPICard title="Total Proveedores" value={proveedores.length} icon={<Users className="h-5 w-5" />} />
        <KPICard title="Activos" value={proveedores.filter(p => p.activo).length} icon={<Users className="h-5 w-5" />} />
        <KPICard title="Órdenes Abiertas" value={ordenes.filter(o => o.estado !== 'recibida' && o.estado !== 'anulada').length} icon={<ClipboardList className="h-5 w-5" />} />
        <KPICard title="Total Órdenes" value={ordenes.length} icon={<Package className="h-5 w-5" />} />
      </div>

      <Tabs defaultValue="proveedores">
        <TabsList>
          <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
          <TabsTrigger value="ordenes">Órdenes de Compra</TabsTrigger>
        </TabsList>

        <TabsContent value="proveedores">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por razón social, código o CUIT..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline"><Upload className="h-4 w-4 mr-1" /> Importar</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setShowImportar(true)}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" /> Importar Proveedores
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowImportarCC(true)}>
                    <DollarSign className="h-4 w-4 mr-2" /> Importar Cuenta Corriente
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={() => { setEditingProv(null); setShowForm(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Nuevo Proveedor
              </Button>
            </div>
          </div>

          <div className="border rounded-lg">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Razón Social</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>CUIT</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No se encontraron proveedores</TableCell></TableRow>
                  ) : filtered.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.codigo_proveedor}</TableCell>
                      <TableCell className="font-medium">{p.razon_social}</TableCell>
                      <TableCell>{p.contacto || '-'}</TableCell>
                      <TableCell>{p.telefono || '-'}</TableCell>
                      <TableCell>{p.cuit || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={p.activo ? 'default' : 'secondary'}>
                          {p.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedProv(p); setShowCC(true); }}>
                              <Eye className="h-4 w-4 mr-2" /> Ver Cuenta Corriente
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setEditingProv(p); setShowForm(true); }}>
                              <Edit className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => eliminarProveedor(p.id)} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="ordenes">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setShowNuevaOrden(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nueva Orden de Compra
            </Button>
          </div>

          <div className="border rounded-lg">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Orden</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Entrega Est.</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingOrdenes ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
                  ) : ordenes.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No hay órdenes de compra</TableCell></TableRow>
                  ) : ordenes.map(o => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono">#{o.numero_orden}</TableCell>
                      <TableCell className="font-medium">{o.proveedor?.razon_social || '-'}</TableCell>
                      <TableCell>{formatDate(o.fecha_orden)}</TableCell>
                      <TableCell>{formatDate(o.fecha_entrega_estimada)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={estadoOrdenColors[o.estado] || ''}>
                          {o.estado.charAt(0).toUpperCase() + o.estado.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatMoney(o.total)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {o.estado === 'borrador' && (
                              <DropdownMenuItem onClick={() => actualizarEstado(o.id, 'confirmada')}>Confirmar</DropdownMenuItem>
                            )}
                            {(o.estado === 'confirmada' || o.estado === 'parcial') && (
                              <DropdownMenuItem onClick={() => actualizarEstado(o.id, 'recibida')}>Marcar Recibida</DropdownMenuItem>
                            )}
                            {o.estado !== 'anulada' && o.estado !== 'recibida' && (
                              <DropdownMenuItem onClick={() => actualizarEstado(o.id, 'anulada')} className="text-destructive">Anular</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </TabsContent>
      </Tabs>

      <ProveedorFormDialog open={showForm} onOpenChange={setShowForm} proveedor={editingProv} onSave={handleSave} />
      <ImportarProveedoresDialog open={showImportar} onOpenChange={setShowImportar} onImported={fetchProveedores} />
      <ImportarCuentaCorrienteDialog open={showImportarCC} onOpenChange={setShowImportarCC} onImported={() => {}} />
      <CuentaCorrienteProveedorDialog open={showCC} onOpenChange={setShowCC} proveedor={selectedProv} />
      <NuevaOrdenCompraDialog open={showNuevaOrden} onOpenChange={setShowNuevaOrden} proveedores={proveedores} onSave={crearOrden} />
    </MainLayout>
  );
}
