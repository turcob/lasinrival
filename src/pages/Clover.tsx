import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Upload, Search, CreditCard, Link2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ImportarCloverDialog } from '@/components/clover/ImportarCloverDialog';

interface CloverPago {
  id: string;
  fecha_pago: string;
  pago_id_clover: string;
  medio_pago: string | null;
  marca_tarjeta: string | null;
  numero_tarjeta: string | null;
  importe: number;
  terminal_id: string | null;
  numero_lote: string | null;
  resultado: string | null;
  nombre_cliente_clover: string | null;
  numero_cuotas: number | null;
  asociado: boolean;
  cliente_id: string | null;
  clientes?: { nombre: string; codigo_cliente: string | null } | null;
}

export default function Clover() {
  const { user } = useAuth();
  const [pagos, setPagos] = useState<CloverPago[]>([]);
  const [loading, setLoading] = useState(true);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterAsociado, setFilterAsociado] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 25;

  const fetchPagos = useCallback(async () => {
    setLoading(true);
    try {
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('clover_pagos')
        .select('id, fecha_pago, pago_id_clover, medio_pago, marca_tarjeta, numero_tarjeta, importe, terminal_id, numero_lote, resultado, nombre_cliente_clover, numero_cuotas, asociado, cliente_id, clientes(nombre, codigo_cliente)', { count: 'exact' });

      if (search) {
        query = query.or(`pago_id_clover.ilike.%${search}%,marca_tarjeta.ilike.%${search}%,numero_tarjeta.ilike.%${search}%,nombre_cliente_clover.ilike.%${search}%,terminal_id.ilike.%${search}%`);
      }

      if (filterAsociado === 'si') {
        query = query.eq('asociado', true);
      } else if (filterAsociado === 'no') {
        query = query.eq('asociado', false);
      }

      const { data, count, error } = await query
        .order('fecha_pago', { ascending: false })
        .range(from, to);

      if (error) throw error;
      setPagos((data as unknown as CloverPago[]) || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error fetching clover pagos:', error);
      toast.error('Error al cargar pagos de Clover');
    } finally {
      setLoading(false);
    }
  }, [currentPage, search, filterAsociado]);

  useEffect(() => {
    fetchPagos();
  }, [fetchPagos]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy HH:mm', { locale: es });
    } catch {
      return dateStr;
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const totalImportado = pagos.reduce((sum, p) => sum + Number(p.importe), 0);
  const totalAsociados = pagos.filter(p => p.asociado).length;

  return (
    <MainLayout>
      <PageHeader title="Clover" description="Gestión de pagos de terminal Clover">
        <Button onClick={() => setImportDialogOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Importar CSV
        </Button>
      </PageHeader>

      <div className="space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Total en página</p>
              <p className="text-2xl font-bold">{formatCurrency(totalImportado)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Registros</p>
              <p className="text-2xl font-bold">{totalCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Asociados (página)</p>
              <p className="text-2xl font-bold">{totalAsociados} / {pagos.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar pagos..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="pl-10"
            />
          </div>
          <Select value={filterAsociado} onValueChange={(v) => { setFilterAsociado(v); setCurrentPage(1); }}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Estado asociación" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="no">Sin asociar</SelectItem>
              <SelectItem value="si">Asociados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>ID Pago</TableHead>
                    <TableHead>Medio</TableHead>
                    <TableHead>Tarjeta</TableHead>
                    <TableHead>Nº Tarjeta</TableHead>
                    <TableHead>Terminal</TableHead>
                    <TableHead>Cuotas</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8">
                        <div className="flex justify-center">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : pagos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                        No hay pagos importados
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagos.map((pago) => (
                      <TableRow key={pago.id}>
                        <TableCell className="whitespace-nowrap text-sm">{formatDate(pago.fecha_pago)}</TableCell>
                        <TableCell className="text-xs font-mono">{pago.pago_id_clover.substring(0, 8)}...</TableCell>
                        <TableCell className="text-sm">{pago.medio_pago || '-'}</TableCell>
                        <TableCell className="text-sm">{pago.marca_tarjeta || '-'}</TableCell>
                        <TableCell className="text-sm font-mono">****{pago.numero_tarjeta || ''}</TableCell>
                        <TableCell className="text-sm font-mono">{pago.terminal_id || '-'}</TableCell>
                        <TableCell className="text-sm text-center">{pago.numero_cuotas || '-'}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(Number(pago.importe))}</TableCell>
                        <TableCell>
                          <Badge variant={pago.resultado === 'SUCCESS' ? 'default' : 'destructive'} className="text-xs">
                            {pago.resultado || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {pago.clientes ? pago.clientes.nombre : (pago.nombre_cliente_clover || '-')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={pago.asociado ? 'default' : 'secondary'} className="text-xs">
                            {pago.asociado ? 'Asociado' : 'Pendiente'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Mostrando {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalCount)} de {totalCount}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">Página {currentPage} de {totalPages}</span>
              <Button variant="outline" size="icon" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <ImportarCloverDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={fetchPagos}
      />
    </MainLayout>
  );
}
