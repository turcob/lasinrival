import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Search, 
  Truck, 
  MapPin, 
  Calendar,
  Clock,
  Package,
  Eye,
  Edit,
  FileText,
  Play,
  CheckCircle
} from 'lucide-react';
import { 
  useVehiculos, 
  useHojasRuta,
  type HojaRutaEstado
} from '@/hooks/useLogistica';
import { DataTable } from '@/components/shared/DataTable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { NuevaHojaRutaDialog } from '@/components/logistica/NuevaHojaRutaDialog';
import { DetalleHojaRutaDialog } from '@/components/logistica/DetalleHojaRutaDialog';
import { VehiculoFormDialog } from '@/components/logistica/VehiculoFormDialog';
import { HojaCargaDialog } from '@/components/logistica/HojaCargaDialog';
import { formatZonasResumen } from '@/lib/hojaRutaZonas';

const estadoConfig: Record<HojaRutaEstado, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  planificada: { label: 'Planificada', variant: 'secondary' },
  en_carga: { label: 'En Carga', variant: 'outline' },
  carga_confirmada: { label: 'Carga OK', variant: 'default' },
  en_ruta: { label: 'En Ruta', variant: 'default' },
  completada: { label: 'Completada', variant: 'secondary' },
  cancelada: { label: 'Cancelada', variant: 'destructive' },
};

export default function Logistica() {
  const [activeTab, setActiveTab] = useState('hojas-ruta');
  const [busqueda, setBusqueda] = useState('');
  const [fechaFiltro, setFechaFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<HojaRutaEstado | ''>('');
  
  // Dialogs
  const [nuevaHojaDialogOpen, setNuevaHojaDialogOpen] = useState(false);
  const [detalleHojaId, setDetalleHojaId] = useState<string | null>(null);
  const [vehiculoDialogOpen, setVehiculoDialogOpen] = useState(false);
  const [vehiculoEditando, setVehiculoEditando] = useState<string | null>(null);
  const [hojaCargaId, setHojaCargaId] = useState<string | null>(null);

  // Data
  const { data: vehiculos = [], isLoading: loadingVehiculos } = useVehiculos();
  const { data: hojasRuta = [], isLoading: loadingHojas } = useHojasRuta({
    estado: estadoFiltro || undefined,
    fecha: fechaFiltro || undefined
  });

  // Filter hojas by search
  const hojasFiltradas = hojasRuta.filter(hoja => {
    if (!busqueda) return true;
    const search = busqueda.toLowerCase();
    return (
      hoja.numero_hoja.toString().includes(search) ||
      hoja.vehiculo?.patente?.toLowerCase().includes(search) ||
      hoja.chofer?.nombre?.toLowerCase().includes(search)
    );
  });

  // Filter vehiculos by search
  const vehiculosFiltrados = vehiculos.filter(v => {
    if (!busqueda) return true;
    const search = busqueda.toLowerCase();
    return (
      v.patente.toLowerCase().includes(search) ||
      v.marca?.toLowerCase().includes(search) ||
      v.modelo?.toLowerCase().includes(search)
    );
  });

  const vehiculosColumns = [
    { 
      key: 'patente',
      header: 'Patente', 
      render: (v: typeof vehiculos[0]) => (
        <span className="font-mono font-medium">{v.patente}</span>
      )
    },
    { 
      key: 'marca',
      header: 'Marca / Modelo', 
      render: (v: typeof vehiculos[0]) => (
        <span>{v.marca} {v.modelo}</span>
      )
    },
    { 
      key: 'capacidad_kg',
      header: 'Capacidad', 
      render: (v: typeof vehiculos[0]) => (
        <div className="text-sm">
          {v.capacidad_kg && <span>{v.capacidad_kg} kg</span>}
          {v.capacidad_kg && v.capacidad_bultos && <span> / </span>}
          {v.capacidad_bultos && <span>{v.capacidad_bultos} bultos</span>}
        </div>
      )
    },
    {
      key: 'id',
      header: 'Acciones',
      render: (v: typeof vehiculos[0]) => (
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => {
            setVehiculoEditando(v.id);
            setVehiculoDialogOpen(true);
          }}
        >
          <Edit className="h-4 w-4" />
        </Button>
      )
    }
  ];

  const hojasColumns = [
    { 
      key: 'numero_hoja',
      header: '#', 
      render: (h: typeof hojasRuta[0]) => (
        <div className="flex flex-col">
          <span className="font-mono font-medium">#{h.numero_hoja}</span>
          {formatZonasResumen(h.paradas as any) && (
            <span className="text-[11px] text-muted-foreground">
              {formatZonasResumen(h.paradas as any)}
            </span>
          )}
        </div>
      )
    },
    { 
      key: 'fecha',
      header: 'Fecha', 
      render: (h: typeof hojasRuta[0]) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>{format(new Date(h.fecha), 'dd/MM/yyyy', { locale: es })}</span>
        </div>
      )
    },
    { 
      key: 'vehiculo',
      header: 'Vehículo', 
      render: (h: typeof hojasRuta[0]) => (
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-muted-foreground" />
          <span>{h.vehiculo?.patente || '-'}</span>
        </div>
      )
    },
    { 
      key: 'chofer',
      header: 'Chofer', 
      render: (h: typeof hojasRuta[0]) => h.chofer?.nombre || '-'
    },
    { 
      key: 'hora_salida_estimada',
      header: 'Hora Salida', 
      render: (h: typeof hojasRuta[0]) => (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span>{h.hora_salida_estimada || '-'}</span>
        </div>
      )
    },
    { 
      key: 'estado',
      header: 'Estado', 
      render: (h: typeof hojasRuta[0]) => {
        const config = estadoConfig[h.estado];
        return <Badge variant={config.variant}>{config.label}</Badge>;
      }
    },
    {
      key: 'id',
      header: 'Acciones',
      render: (h: typeof hojasRuta[0]) => (
        <div className="flex gap-1">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setDetalleHojaId(h.id)}
            title="Ver detalle"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setHojaCargaId(h.id)}
            title="Hoja de carga"
          >
            <FileText className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <MainLayout>
      <PageHeader
        title="Logística y Distribución"
        description="Gestión de vehículos, hojas de ruta y entregas"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <TabsList>
            <TabsTrigger value="hojas-ruta" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Hojas de Ruta
            </TabsTrigger>
            <TabsTrigger value="vehiculos" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Vehículos
            </TabsTrigger>
          </TabsList>

          {activeTab === 'hojas-ruta' && (
            <Button onClick={() => setNuevaHojaDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Hoja de Ruta
            </Button>
          )}
          {activeTab === 'vehiculos' && (
            <Button onClick={() => {
              setVehiculoEditando(null);
              setVehiculoDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Vehículo
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={activeTab === 'hojas-ruta' ? "Buscar por número, patente o chofer..." : "Buscar por patente, marca..."}
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-10"
                />
              </div>
              {activeTab === 'hojas-ruta' && (
                <>
                  <Input
                    type="date"
                    value={fechaFiltro}
                    onChange={(e) => setFechaFiltro(e.target.value)}
                    className="w-full sm:w-40"
                  />
                  <select
                    value={estadoFiltro}
                    onChange={(e) => setEstadoFiltro(e.target.value as HojaRutaEstado | '')}
                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm w-full sm:w-40"
                  >
                    <option value="">Todos los estados</option>
                    <option value="planificada">Planificada</option>
                    <option value="en_carga">En Carga</option>
                    <option value="carga_confirmada">Carga Confirmada</option>
                    <option value="en_ruta">En Ruta</option>
                    <option value="completada">Completada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <TabsContent value="hojas-ruta">
          {/* KPIs */}
          <div className="grid gap-4 md:grid-cols-4 mb-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Planificadas</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {hojasRuta.filter(h => h.estado === 'planificada').length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">En Ruta</CardTitle>
                <Play className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {hojasRuta.filter(h => h.estado === 'en_ruta').length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completadas Hoy</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {hojasRuta.filter(h => 
                    h.estado === 'completada' && 
                    h.fecha === format(new Date(), 'yyyy-MM-dd')
                  ).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Vehículos Activos</CardTitle>
                <Truck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{vehiculos.length}</div>
              </CardContent>
            </Card>
          </div>

          <DataTable
            data={hojasFiltradas}
            columns={hojasColumns}
            loading={loadingHojas}
          />
        </TabsContent>

        <TabsContent value="vehiculos">
          <DataTable
            data={vehiculosFiltrados}
            columns={vehiculosColumns}
            loading={loadingVehiculos}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <NuevaHojaRutaDialog
        open={nuevaHojaDialogOpen}
        onOpenChange={setNuevaHojaDialogOpen}
      />

      <DetalleHojaRutaDialog
        hojaRutaId={detalleHojaId}
        open={!!detalleHojaId}
        onOpenChange={(open) => !open && setDetalleHojaId(null)}
      />

      <VehiculoFormDialog
        open={vehiculoDialogOpen}
        onOpenChange={setVehiculoDialogOpen}
        vehiculoId={vehiculoEditando}
      />

      <HojaCargaDialog
        hojaRutaId={hojaCargaId}
        open={!!hojaCargaId}
        onOpenChange={(open) => !open && setHojaCargaId(null)}
      />
    </MainLayout>
  );
}
