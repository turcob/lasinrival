import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Download, Search } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PagoCliente {
  id: string;
  monto: number;
  fecha: string;
  concepto: string | null;
  estado_imputacion: string | null;
  forma_pago_nombre: string | null;
  cliente_nombre: string;
  zona_nombre: string | null;
}

export default function ReportePagos() {
  const [pagos, setPagos] = useState<PagoCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [formasPago, setFormasPago] = useState<{ id: string; nombre: string }[]>([]);
  const [zonas, setZonas] = useState<{ id: string; nombre: string }[]>([]);

  // Filters
  const [filtroFormaPago, setFiltroFormaPago] = useState<string>('todas');
  const [filtroZona, setFiltroZona] = useState<string>('todas');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [fechaDesde, setFechaDesde] = useState<Date | undefined>(undefined);
  const [fechaHasta, setFechaHasta] = useState<Date | undefined>(undefined);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pagosRes, fpRes, zonasRes] = await Promise.all([
        supabase
          .from('cliente_movimientos')
          .select(`id, monto, fecha, concepto, estado_imputacion, forma_pago_id, formas_pago(nombre), clientes(nombre, zona_id, zonas(nombre))`)
          .eq('tipo', 'pago')
          .order('fecha', { ascending: false })
          .limit(1000),
        supabase.from('formas_pago').select('id, nombre').eq('activo', true).order('nombre'),
        supabase.from('zonas').select('id, nombre').eq('activo', true).order('nombre'),
      ]);

      if (pagosRes.data) {
        setPagos(pagosRes.data.map((p: any) => ({
          id: p.id,
          monto: p.monto,
          fecha: p.fecha,
          concepto: p.concepto,
          estado_imputacion: p.estado_imputacion,
          forma_pago_nombre: p.formas_pago?.nombre || 'Sin especificar',
          cliente_nombre: p.clientes?.nombre || 'Cliente desconocido',
          zona_nombre: p.clientes?.zonas?.nombre || null,
        })));
      }
      if (fpRes.data) setFormasPago(fpRes.data);
      if (zonasRes.data) setZonas(zonasRes.data);
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar los pagos');
    } finally {
      setLoading(false);
    }
  };

  const pagosFiltrados = useMemo(() => {
    return pagos.filter(p => {
      if (filtroFormaPago !== 'todas' && p.forma_pago_nombre?.toLowerCase() !== filtroFormaPago.toLowerCase()) return false;
      if (filtroZona !== 'todas' && p.zona_nombre !== filtroZona) return false;
      if (filtroCliente && !p.cliente_nombre.toLowerCase().includes(filtroCliente.toLowerCase())) return false;
      if (fechaDesde && new Date(p.fecha) < fechaDesde) return false;
      if (fechaHasta) {
        const hasta = new Date(fechaHasta);
        hasta.setHours(23, 59, 59);
        if (new Date(p.fecha) > hasta) return false;
      }
      return true;
    });
  }, [pagos, filtroFormaPago, filtroZona, filtroCliente, fechaDesde, fechaHasta]);

  const totalesPorMedio = useMemo(() => {
    const map: Record<string, number> = {};
    pagosFiltrados.forEach(p => {
      const key = p.forma_pago_nombre || 'Sin especificar';
      map[key] = (map[key] || 0) + p.monto;
    });
    return map;
  }, [pagosFiltrados]);

  const totalGeneral = useMemo(() => pagosFiltrados.reduce((s, p) => s + p.monto, 0), [pagosFiltrados]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);

  const exportarCSV = () => {
    const headers = ['Fecha', 'Cliente', 'Zona', 'Medio de Pago', 'Monto', 'Estado', 'Concepto'];
    const rows = pagosFiltrados.map(p => [
      p.fecha ? format(new Date(p.fecha), 'dd/MM/yyyy') : '',
      p.cliente_nombre,
      p.zona_nombre || '',
      p.forma_pago_nombre || '',
      p.monto.toString(),
      p.estado_imputacion || '',
      p.concepto || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-pagos-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <MainLayout>
      <PageHeader title="Reporte de Pagos" description="Visualizá y filtrá los pagos realizados por clientes" />

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <Label className="text-xs">Medio de Pago</Label>
              <Select value={filtroFormaPago} onValueChange={setFiltroFormaPago}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todos</SelectItem>
                  {formasPago.map(fp => (
                    <SelectItem key={fp.id} value={fp.nombre}>{fp.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Zona</Label>
              <Select value={filtroZona} onValueChange={setFiltroZona}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {zonas.map(z => (
                    <SelectItem key={z.id} value={z.nombre}>{z.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Cliente</Label>
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  className="pl-8"
                  value={filtroCliente}
                  onChange={(e) => setFiltroCliente(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm", !fechaDesde && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {fechaDesde ? format(fechaDesde, 'dd/MM/yyyy') : 'Fecha desde'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={fechaDesde} onSelect={setFechaDesde} initialFocus className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm", !fechaHasta && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {fechaHasta ? format(fechaHasta, 'dd/MM/yyyy') : 'Fecha hasta'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={fechaHasta} onSelect={setFechaHasta} initialFocus className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <Button variant="ghost" size="sm" onClick={() => {
              setFiltroFormaPago('todas');
              setFiltroZona('todas');
              setFiltroCliente('');
              setFechaDesde(undefined);
              setFechaHasta(undefined);
            }}>
              Limpiar filtros
            </Button>
            <Button variant="outline" size="sm" onClick={exportarCSV}>
              <Download className="h-3.5 w-3.5 mr-1" /> Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Totals by payment method */}
      {Object.keys(totalesPorMedio).length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          {Object.entries(totalesPorMedio).map(([medio, total]) => (
            <Card key={medio}>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">{medio}</p>
                <p className="text-lg font-bold">{formatCurrency(total)}</p>
              </CardContent>
            </Card>
          ))}
          <Card className="border-primary/30">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground font-medium">Total General</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(totalGeneral)}</p>
              <p className="text-xs text-muted-foreground">{pagosFiltrados.length} pagos</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : pagosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No se encontraron pagos con los filtros seleccionados
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Zona</TableHead>
                  <TableHead>Medio de Pago</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Concepto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagosFiltrados.map(pago => (
                  <TableRow key={pago.id}>
                    <TableCell className="whitespace-nowrap">
                      {pago.fecha ? format(new Date(pago.fecha), 'dd/MM/yyyy', { locale: es }) : '-'}
                    </TableCell>
                    <TableCell className="font-medium">{pago.cliente_nombre}</TableCell>
                    <TableCell>{pago.zona_nombre || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{pago.forma_pago_nombre}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(pago.monto)}</TableCell>
                    <TableCell>
                      <Badge variant={pago.estado_imputacion === 'confirmado' ? 'default' : 'secondary'}>
                        {pago.estado_imputacion || 'confirmado'}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                      {pago.concepto || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </MainLayout>
  );
}
