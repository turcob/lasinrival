import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, Link2, FileText, Receipt, User, ChevronDown, ChevronRight, History } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Cliente {
  id: string;
  codigo_cliente: string | null;
  nombre: string;
  dni_cuit: string | null;
}

interface Imputacion {
  id: string;
  monto: number;
  created_at: string;
  movimiento_pago_id: string;
  pago_concepto?: string;
  pago_fecha?: string;
  pago_monto?: number;
}

interface FacturaConImputaciones {
  id: string;
  concepto: string;
  fecha: string | null;
  monto: number;
  saldo_pendiente: number;
  imputaciones: Imputacion[];
}

interface PagoDisponible {
  id: string;
  fecha: string | null;
  monto: number;
  concepto: string | null;
  forma_pago_id: string | null;
  formas_pago?: { nombre: string } | null;
  saldo_disponible: number;
}

export default function AsociacionPagos() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Cliente[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [saldoActual, setSaldoActual] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'asociar' | 'historial'>('historial');

  // Facturas con sus imputaciones
  const [facturasConImputaciones, setFacturasConImputaciones] = useState<FacturaConImputaciones[]>([]);
  const [expandedFacturas, setExpandedFacturas] = useState<Set<string>>(new Set());

  // Facturas pendientes para asociar
  const [facturasPendientes, setFacturasPendientes] = useState<FacturaConImputaciones[]>([]);
  const [selectedFacturas, setSelectedFacturas] = useState<Set<string>>(new Set());

  // Pagos disponibles
  const [pagosDisponibles, setPagosDisponibles] = useState<PagoDisponible[]>([]);
  const [selectedPagos, setSelectedPagos] = useState<Set<string>>(new Set());

  const [associating, setAssociating] = useState(false);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.length >= 2) {
        searchClientes();
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const searchClientes = async () => {
    const { data } = await supabase
      .from('clientes')
      .select('id, codigo_cliente, nombre, dni_cuit')
      .or(`nombre.ilike.%${searchTerm}%,dni_cuit.ilike.%${searchTerm}%,codigo_cliente.ilike.%${searchTerm}%`)
      .eq('activo', true)
      .limit(10);

    setSearchResults(data || []);
  };

  const selectCliente = async (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setSearchTerm('');
    setSearchResults([]);
    setSelectedFacturas(new Set());
    setSelectedPagos(new Set());
    setExpandedFacturas(new Set());
    await loadClienteData(cliente.id);
  };

  const loadClienteData = useCallback(async (clienteId: string) => {
    setLoading(true);
    try {
      // Fetch saldo
      const { data: saldoData } = await supabase
        .from('cliente_saldos')
        .select('saldo_actual')
        .eq('cliente_id', clienteId)
        .maybeSingle();

      setSaldoActual(Number(saldoData?.saldo_actual) || 0);

      // Fetch todas las facturas (compra + saldo_inicial)
      const { data: facturas } = await supabase
        .from('cliente_movimientos')
        .select('id, concepto, fecha, monto')
        .eq('cliente_id', clienteId)
        .in('tipo', ['compra', 'saldo_inicial'])
        .order('fecha', { ascending: false });

      if (!facturas || facturas.length === 0) {
        setFacturasConImputaciones([]);
        setFacturasPendientes([]);
        setPagosDisponibles([]);
        setLoading(false);
        return;
      }

      // Fetch imputaciones para estas facturas
      const facturaIds = facturas.map(f => f.id);
      const { data: imputaciones } = await supabase
        .from('cliente_movimiento_imputaciones')
        .select('id, movimiento_factura_id, movimiento_pago_id, monto, created_at')
        .in('movimiento_factura_id', facturaIds);

      // Fetch datos de los pagos relacionados
      const pagoIds = [...new Set(imputaciones?.map(i => i.movimiento_pago_id) || [])];
      const { data: pagosData } = pagoIds.length > 0 
        ? await supabase
            .from('cliente_movimientos')
            .select('id, concepto, fecha, monto')
            .in('id', pagoIds)
        : { data: [] };

      type PagoInfo = { id: string; concepto: string | null; fecha: string | null; monto: number };
      const pagosMap = new Map<string, PagoInfo>(
        (pagosData || []).map(p => [p.id, p as PagoInfo])
      );

      // Construir facturas con imputaciones
      const facturasResult: FacturaConImputaciones[] = facturas.map(factura => {
        const facImputaciones = imputaciones
          ?.filter(i => i.movimiento_factura_id === factura.id)
          .map(i => {
            const pago = pagosMap.get(i.movimiento_pago_id);
            return {
              id: i.id,
              monto: Number(i.monto),
              created_at: i.created_at,
              movimiento_pago_id: i.movimiento_pago_id,
              pago_concepto: pago?.concepto || undefined,
              pago_fecha: pago?.fecha || undefined,
              pago_monto: pago ? Number(pago.monto) : undefined
            };
          }) || [];

        const totalImputado = facImputaciones.reduce((sum, i) => sum + i.monto, 0);

        return {
          id: factura.id,
          concepto: factura.concepto || 'Sin concepto',
          fecha: factura.fecha,
          monto: Number(factura.monto),
          saldo_pendiente: Number(factura.monto) - totalImputado,
          imputaciones: facImputaciones
        };
      });

      setFacturasConImputaciones(facturasResult);
      setFacturasPendientes(facturasResult.filter(f => f.saldo_pendiente > 0.01));

      // Fetch pagos disponibles (con saldo disponible)
      const { data: todosLosPagos } = await supabase
        .from('cliente_movimientos')
        .select('id, fecha, monto, concepto, forma_pago_id, formas_pago(nombre)')
        .eq('cliente_id', clienteId)
        .in('tipo', ['pago', 'nota_credito'])
        .eq('estado_imputacion', 'confirmado')
        .order('fecha', { ascending: false });

      // Fetch imputaciones de estos pagos
      const allPagoIds = todosLosPagos?.map(p => p.id) || [];
      const { data: imputacionesPagos } = allPagoIds.length > 0
        ? await supabase
            .from('cliente_movimiento_imputaciones')
            .select('movimiento_pago_id, monto')
            .in('movimiento_pago_id', allPagoIds)
        : { data: [] };

      // Calcular saldo disponible de cada pago
      const pagosConSaldo: PagoDisponible[] = (todosLosPagos || []).map(pago => {
        const imputado = imputacionesPagos
          ?.filter(i => i.movimiento_pago_id === pago.id)
          .reduce((sum, i) => sum + Number(i.monto), 0) || 0;
        
        return {
          ...pago,
          monto: Number(pago.monto),
          saldo_disponible: Number(pago.monto) - imputado
        };
      }).filter(p => p.saldo_disponible > 0.01);

      setPagosDisponibles(pagosConSaldo);
    } catch (error) {
      console.error('Error loading cliente data:', error);
      toast.error('Error al cargar datos del cliente');
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleFactura = (id: string) => {
    const newSet = new Set(selectedFacturas);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedFacturas(newSet);
  };

  const togglePago = (id: string) => {
    const newSet = new Set(selectedPagos);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedPagos(newSet);
  };

  const toggleExpandFactura = (id: string) => {
    const newSet = new Set(expandedFacturas);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedFacturas(newSet);
  };

  const totalFacturasSeleccionadas = facturasPendientes
    .filter(f => selectedFacturas.has(f.id))
    .reduce((sum, f) => sum + f.saldo_pendiente, 0);

  const totalPagosSeleccionados = pagosDisponibles
    .filter(p => selectedPagos.has(p.id))
    .reduce((sum, p) => sum + p.saldo_disponible, 0);

  const handleAsociar = async () => {
    if (selectedFacturas.size === 0 || selectedPagos.size === 0) {
      toast.error('Selecciona al menos una factura y un pago');
      return;
    }

    setAssociating(true);
    try {
      // Ordenar facturas por fecha ASC (más antiguas primero)
      const facturasSeleccionadas = facturasPendientes
        .filter(f => selectedFacturas.has(f.id))
        .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));

      // Ordenar pagos por fecha ASC
      const pagosSeleccionados = pagosDisponibles
        .filter(p => selectedPagos.has(p.id))
        .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));

      const imputaciones: Array<{
        movimiento_pago_id: string;
        movimiento_factura_id: string;
        monto: number;
      }> = [];

      // Hacer copia de saldos para ir restando
      const saldosFacturas = new Map(facturasSeleccionadas.map(f => [f.id, f.saldo_pendiente]));
      const saldosPagos = new Map(pagosSeleccionados.map(p => [p.id, p.saldo_disponible]));

      for (const pago of pagosSeleccionados) {
        let saldoDisponible = saldosPagos.get(pago.id) || 0;

        for (const factura of facturasSeleccionadas) {
          if (saldoDisponible <= 0.01) break;
          
          const saldoPendiente = saldosFacturas.get(factura.id) || 0;
          if (saldoPendiente <= 0.01) continue;

          const montoImputar = Math.min(saldoDisponible, saldoPendiente);

          imputaciones.push({
            movimiento_pago_id: pago.id,
            movimiento_factura_id: factura.id,
            monto: montoImputar
          });

          saldoDisponible -= montoImputar;
          saldosPagos.set(pago.id, saldoDisponible);
          saldosFacturas.set(factura.id, saldoPendiente - montoImputar);
        }
      }

      if (imputaciones.length > 0) {
        const { error } = await supabase
          .from('cliente_movimiento_imputaciones')
          .insert(imputaciones);

        if (error) throw error;

        toast.success(`${imputaciones.length} imputaciones creadas correctamente`);
      }

      setSelectedFacturas(new Set());
      setSelectedPagos(new Set());
      
      if (selectedCliente) {
        await loadClienteData(selectedCliente.id);
      }
    } catch (error) {
      console.error('Error associating payments:', error);
      toast.error('Error al asociar pagos');
    } finally {
      setAssociating(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), 'dd/MM/yyyy', { locale: es });
  };

  return (
    <MainLayout>
      <PageHeader 
        title="Asociación de Pagos" 
        description="Vincular pagos con facturas y ver historial de imputaciones"
      />

      <div className="space-y-6">
        {/* Search section */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente por nombre, DNI/CUIT o código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
                  {searchResults.map((cliente) => (
                    <button
                      key={cliente.id}
                      onClick={() => selectCliente(cliente)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent"
                    >
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{cliente.nombre}</p>
                        <p className="text-sm text-muted-foreground">
                          {cliente.codigo_cliente && `Cód: ${cliente.codigo_cliente} · `}
                          {cliente.dni_cuit}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Selected client info */}
        {selectedCliente && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{selectedCliente.nombre}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedCliente.codigo_cliente && `Código: ${selectedCliente.codigo_cliente}`}
                      {selectedCliente.dni_cuit && ` · DNI/CUIT: ${selectedCliente.dni_cuit}`}
                    </p>
                  </div>
                </div>
                <Badge variant={saldoActual > 0 ? 'destructive' : saldoActual < 0 ? 'default' : 'secondary'}>
                  Saldo: {formatCurrency(saldoActual)}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        {selectedCliente && !loading && (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'asociar' | 'historial')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="historial">
                <History className="mr-2 h-4 w-4" />
                Historial de Imputaciones
              </TabsTrigger>
              <TabsTrigger value="asociar">
                <Link2 className="mr-2 h-4 w-4" />
                Asociar Pagos
              </TabsTrigger>
            </TabsList>

            {/* Historial Tab */}
            <TabsContent value="historial" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-5 w-5" />
                    Facturas e Imputaciones
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {facturasConImputaciones.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No hay facturas registradas
                    </p>
                  ) : (
                    <ScrollArea className="h-[500px]">
                      <div className="space-y-2">
                        {facturasConImputaciones.map((factura) => (
                          <Collapsible
                            key={factura.id}
                            open={expandedFacturas.has(factura.id)}
                            onOpenChange={() => toggleExpandFactura(factura.id)}
                          >
                            <div className={`rounded-lg border ${factura.saldo_pendiente > 0.01 ? 'border-destructive/30' : 'border-primary/30'}`}>
                              <CollapsibleTrigger className="w-full">
                                <div className="flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors">
                                  {expandedFacturas.has(factura.id) ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                  <div className="flex-1 text-left">
                                    <p className="font-medium">{factura.concepto}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {formatDate(factura.fecha)} · Total: {formatCurrency(factura.monto)}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {factura.imputaciones.length > 0 && (
                                      <Badge variant="outline" className="text-xs">
                                        {factura.imputaciones.length} imputaciones
                                      </Badge>
                                    )}
                                    <Badge 
                                      variant={factura.saldo_pendiente > 0.01 ? 'destructive' : 'default'}
                                      className="min-w-[100px] justify-center"
                                    >
                                      {factura.saldo_pendiente > 0.01 
                                        ? `Debe: ${formatCurrency(factura.saldo_pendiente)}`
                                        : 'Cancelada'
                                      }
                                    </Badge>
                                  </div>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="border-t bg-muted/30 p-3">
                                  {factura.imputaciones.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-2">
                                      Sin imputaciones registradas
                                    </p>
                                  ) : (
                                    <div className="space-y-2">
                                      <p className="text-xs font-medium text-muted-foreground mb-2">
                                        Pagos imputados a esta factura:
                                      </p>
                                      {factura.imputaciones.map((imp) => (
                                        <div 
                                          key={imp.id}
                                          className="flex items-center justify-between rounded bg-background p-2 text-sm"
                                        >
                                          <div className="flex items-center gap-2">
                                            <Receipt className="h-3 w-3 text-primary" />
                                            <span>{imp.pago_concepto || 'Pago'}</span>
                                            <span className="text-muted-foreground">
                                              ({formatDate(imp.pago_fecha)})
                                            </span>
                                          </div>
                                          <span className="font-medium text-primary">
                                            {formatCurrency(imp.monto)}
                                          </span>
                                        </div>
                                      ))}
                                      <div className="flex justify-end pt-2 border-t mt-2">
                                        <span className="text-sm text-muted-foreground">
                                          Total imputado: <span className="font-medium text-foreground">
                                            {formatCurrency(factura.imputaciones.reduce((s, i) => s + i.monto, 0))}
                                          </span>
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Asociar Tab */}
            <TabsContent value="asociar" className="space-y-4">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Facturas pendientes */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FileText className="h-5 w-5" />
                      Facturas Pendientes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {facturasPendientes.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        No hay facturas pendientes
                      </p>
                    ) : (
                      <>
                        <ScrollArea className="h-[300px]">
                          <div className="space-y-2">
                            {facturasPendientes.map((factura) => (
                              <div
                                key={factura.id}
                                className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                                  selectedFacturas.has(factura.id) ? 'border-primary bg-primary/5' : ''
                                }`}
                              >
                                <Checkbox
                                  checked={selectedFacturas.has(factura.id)}
                                  onCheckedChange={() => toggleFactura(factura.id)}
                                />
                                <div className="flex-1">
                                  <p className="font-medium">{factura.concepto}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {formatDate(factura.fecha)} · Total: {formatCurrency(factura.monto)}
                                  </p>
                                </div>
                                <Badge variant="outline" className="text-destructive">
                                  Debe: {formatCurrency(factura.saldo_pendiente)}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                        <div className="mt-4 flex justify-between border-t pt-4">
                          <span className="text-sm text-muted-foreground">
                            {selectedFacturas.size} seleccionadas
                          </span>
                          <span className="font-medium">
                            Total: {formatCurrency(totalFacturasSeleccionadas)}
                          </span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Pagos disponibles */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Receipt className="h-5 w-5" />
                      Pagos Disponibles
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {pagosDisponibles.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        No hay pagos sin imputar completamente
                      </p>
                    ) : (
                      <>
                        <ScrollArea className="h-[300px]">
                          <div className="space-y-2">
                            {pagosDisponibles.map((pago) => (
                              <div
                                key={pago.id}
                                className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                                  selectedPagos.has(pago.id) ? 'border-primary bg-primary/5' : ''
                                }`}
                              >
                                <Checkbox
                                  checked={selectedPagos.has(pago.id)}
                                  onCheckedChange={() => togglePago(pago.id)}
                                />
                                <div className="flex-1">
                                  <p className="font-medium">
                                    {pago.concepto || 'Pago'}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {formatDate(pago.fecha)}
                                    {pago.formas_pago?.nombre && ` · ${pago.formas_pago.nombre}`}
                                    {pago.saldo_disponible < pago.monto && (
                                      <span className="ml-1 text-xs">
                                        (Total: {formatCurrency(pago.monto)})
                                      </span>
                                    )}
                                  </p>
                                </div>
                                <Badge variant="outline" className="text-primary">
                                  {formatCurrency(pago.saldo_disponible)}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                        <div className="mt-4 flex justify-between border-t pt-4">
                          <span className="text-sm text-muted-foreground">
                            {selectedPagos.size} seleccionados
                          </span>
                          <span className="font-medium text-primary">
                            Total: {formatCurrency(totalPagosSeleccionados)}
                          </span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Action button */}
              {(selectedFacturas.size > 0 || selectedPagos.size > 0) && (
                <div className="flex justify-center">
                  <Button
                    size="lg"
                    onClick={handleAsociar}
                    disabled={associating || selectedFacturas.size === 0 || selectedPagos.size === 0}
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    {associating ? 'Asociando...' : 'Asociar Pagos Seleccionados'}
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </div>
    </MainLayout>
  );
}
