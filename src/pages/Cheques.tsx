import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { KPICard } from '@/components/shared/KPICard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCheques, Cheque, ChequeEstado } from '@/hooks/useCheques';
import { NuevoChequeDialog } from '@/components/cheques/NuevoChequeDialog';
import { CambiarEstadoChequeDialog } from '@/components/cheques/CambiarEstadoChequeDialog';
import { HistorialChequeDialog } from '@/components/cheques/HistorialChequeDialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Wallet, AlertTriangle, Ban, Clock, TrendingUp, Building2, Users, History, ArrowRightLeft, Search } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const ESTADO_LABELS: Record<ChequeEstado, string> = {
  en_cartera: 'En Cartera',
  depositado: 'Depositado',
  cobrado: 'Cobrado',
  rechazado: 'Rechazado',
  endosado: 'Endosado',
  vencido: 'Vencido',
  anulado: 'Anulado',
};

const ESTADO_COLORS: Record<ChequeEstado, string> = {
  en_cartera: 'bg-blue-100 text-blue-800',
  depositado: 'bg-amber-100 text-amber-800',
  cobrado: 'bg-green-100 text-green-800',
  rechazado: 'bg-red-100 text-red-800',
  endosado: 'bg-purple-100 text-purple-800',
  vencido: 'bg-orange-100 text-orange-800',
  anulado: 'bg-gray-100 text-gray-800',
};

const PIE_COLORS = ['hsl(217, 91%, 50%)', 'hsl(38, 92%, 50%)', 'hsl(142, 76%, 36%)', 'hsl(0, 84%, 60%)', 'hsl(280, 65%, 60%)', 'hsl(25, 95%, 53%)', 'hsl(215, 16%, 47%)'];

const fmt = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`;

export default function Cheques() {
  const { cheques, loading, kpis, analysisPorBanco, analysisPorCliente, alertas, crearCheque, cambiarEstado, fetchHistorial } = useCheques();
  const [showNuevo, setShowNuevo] = useState(false);
  const [chequeEstado, setChequeEstado] = useState<Cheque | null>(null);
  const [chequeHistorial, setChequeHistorial] = useState<Cheque | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroBanco, setFiltroBanco] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const chequesFiltrados = useMemo(() => {
    return cheques.filter(c => {
      if (filtroEstado !== 'todos' && c.estado !== filtroEstado) return false;
      if (filtroTipo !== 'todos' && c.tipo !== filtroTipo) return false;
      if (filtroBanco && !c.banco.toLowerCase().includes(filtroBanco.toLowerCase())) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        return c.numero_cheque.toLowerCase().includes(q) ||
          c.emisor.toLowerCase().includes(q) ||
          (c.cliente as any)?.nombre?.toLowerCase().includes(q) ||
          c.banco.toLowerCase().includes(q);
      }
      return true;
    });
  }, [cheques, filtroEstado, filtroTipo, filtroBanco, busqueda]);

  // Chart data: distribution by state
  const estadoChartData = useMemo(() => {
    const map: Record<string, number> = {};
    cheques.forEach(c => {
      map[c.estado] = (map[c.estado] || 0) + Number(c.monto);
    });
    return Object.entries(map).map(([estado, total]) => ({
      name: ESTADO_LABELS[estado as ChequeEstado],
      value: total,
    }));
  }, [cheques]);

  const bancoChartData = useMemo(() => {
    return analysisPorBanco.slice(0, 8).map(b => ({
      name: b.banco.length > 12 ? b.banco.slice(0, 12) + '…' : b.banco,
      total: b.total,
      cantidad: b.cantidad,
    }));
  }, [analysisPorBanco]);

  return (
    <MainLayout>
      <PageHeader title="Gestión de Cheques" description="Control completo del ciclo de vida de cheques">
        <Button onClick={() => setShowNuevo(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo Cheque
        </Button>
      </PageHeader>

      {/* Alertas */}
      {alertas.length > 0 && (
        <Card className="mb-6 border-warning/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-warning">
              <AlertTriangle className="h-4 w-4" /> Alertas ({alertas.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alertas.slice(0, 5).map((a, i) => (
              <div key={i} className={`text-sm rounded-md px-3 py-2 ${a.tipo === 'urgente' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}`}>
                {a.mensaje}
              </div>
            ))}
            {alertas.length > 5 && (
              <p className="text-xs text-muted-foreground">+{alertas.length - 5} alertas más</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard title="En Cartera" value={fmt(kpis.totalEnCartera)} description={`${kpis.cantEnCartera} cheques`} icon={<Wallet className="h-5 w-5" />} />
        <KPICard title="Por Vencer (7 días)" value={fmt(kpis.montoPorVencer)} description={`${kpis.porVencer} cheques`} icon={<Clock className="h-5 w-5" />} />
        <KPICard title="Rechazados" value={fmt(kpis.totalRechazados)} description={`${kpis.rechazados} cheques`} icon={<Ban className="h-5 w-5" />} className={kpis.rechazados > 0 ? 'border-destructive/30' : ''} />
        <KPICard title="Cobrados" value={fmt(kpis.totalCobrados)} description={`${kpis.cobrados} cheques`} icon={<TrendingUp className="h-5 w-5" />} />
      </div>

      <Tabs defaultValue="listado" className="space-y-4">
        <TabsList>
          <TabsTrigger value="listado">Listado</TabsTrigger>
          <TabsTrigger value="analisis">Análisis</TabsTrigger>
        </TabsList>

        {/* Tab: Listado */}
        <TabsContent value="listado" className="space-y-4">
          {/* Filtros */}
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar..." className="pl-9" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
                </div>
                <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los estados</SelectItem>
                    {Object.entries(ESTADO_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los tipos</SelectItem>
                    <SelectItem value="terceros">De Terceros</SelectItem>
                    <SelectItem value="propio">Propios</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Filtrar por banco..." value={filtroBanco} onChange={e => setFiltroBanco(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* Tabla */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : chequesFiltrados.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">No se encontraron cheques</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº Cheque</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Emisor</TableHead>
                      <TableHead>Banco</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Emisión</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chequesFiltrados.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.numero_cheque}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{c.tipo === 'terceros' ? 'Terceros' : 'Propio'}</Badge>
                        </TableCell>
                        <TableCell>
                          <div>{c.emisor}</div>
                          {(c.cliente as any)?.nombre && (
                            <div className="text-xs text-muted-foreground">{(c.cliente as any).nombre}</div>
                          )}
                        </TableCell>
                        <TableCell>{c.banco}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(Number(c.monto))}</TableCell>
                        <TableCell>{format(new Date(c.fecha_emision), 'dd/MM/yy')}</TableCell>
                        <TableCell>{format(new Date(c.fecha_vencimiento), 'dd/MM/yy')}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={ESTADO_COLORS[c.estado]}>
                            {ESTADO_LABELS[c.estado]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" title="Cambiar estado" onClick={() => setChequeEstado(c)}>
                              <ArrowRightLeft className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Historial" onClick={() => setChequeHistorial(c)}>
                              <History className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Análisis */}
        <TabsContent value="analisis" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Distribución por estado */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Distribución por Estado</CardTitle>
              </CardHeader>
              <CardContent>
                {estadoChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={estadoChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {estadoChartData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
                )}
              </CardContent>
            </Card>

            {/* Por banco */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2"><Building2 className="h-4 w-4" /> Montos por Banco</CardTitle>
              </CardHeader>
              <CardContent>
                {bancoChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={bancoChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis fontSize={12} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Bar dataKey="total" fill="hsl(217, 91%, 50%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tabla por banco */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2"><Building2 className="h-4 w-4" /> Detalle por Banco</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Banco</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Monto Total</TableHead>
                    <TableHead className="text-right">Rechazados</TableHead>
                    <TableHead className="text-right">% Rechazo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysisPorBanco.map(b => (
                    <TableRow key={b.banco}>
                      <TableCell className="font-medium">{b.banco}</TableCell>
                      <TableCell className="text-right">{b.cantidad}</TableCell>
                      <TableCell className="text-right">{fmt(b.total)}</TableCell>
                      <TableCell className="text-right">{b.rechazados}</TableCell>
                      <TableCell className="text-right">
                        <span className={b.cantidad > 0 && b.rechazados / b.cantidad > 0.2 ? 'text-destructive font-medium' : ''}>
                          {b.cantidad > 0 ? Math.round(b.rechazados / b.cantidad * 100) : 0}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Tabla por cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2"><Users className="h-4 w-4" /> Detalle por Cliente</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Monto Total</TableHead>
                    <TableHead className="text-right">Rechazados</TableHead>
                    <TableHead className="text-right">% Rechazo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysisPorCliente.slice(0, 20).map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nombre}</TableCell>
                      <TableCell className="text-right">{c.cantidad}</TableCell>
                      <TableCell className="text-right">{fmt(c.total)}</TableCell>
                      <TableCell className="text-right">{c.rechazados}</TableCell>
                      <TableCell className="text-right">
                        <span className={c.cantidad > 0 && c.rechazados / c.cantidad > 0.2 ? 'text-destructive font-medium' : ''}>
                          {c.cantidad > 0 ? Math.round(c.rechazados / c.cantidad * 100) : 0}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <NuevoChequeDialog open={showNuevo} onOpenChange={setShowNuevo} onSubmit={crearCheque} />
      <CambiarEstadoChequeDialog open={!!chequeEstado} onOpenChange={o => !o && setChequeEstado(null)} cheque={chequeEstado} onSubmit={cambiarEstado} />
      <HistorialChequeDialog open={!!chequeHistorial} onOpenChange={o => !o && setChequeHistorial(null)} cheque={chequeHistorial} fetchHistorial={fetchHistorial} />
    </MainLayout>
  );
}
