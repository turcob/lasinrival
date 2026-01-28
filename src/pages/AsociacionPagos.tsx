import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, Link2, FileText, Receipt, User } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Cliente {
  id: string;
  codigo_cliente: string | null;
  nombre: string;
  dni_cuit: string | null;
}

interface Venta {
  id: string;
  numero_comprobante: number;
  fecha: string | null;
  total: number;
  saldo_pendiente: number;
}

interface PagoDisponible {
  id: string;
  fecha: string | null;
  monto: number;
  concepto: string | null;
  forma_pago_id: string | null;
  formas_pago?: { nombre: string } | null;
}

export default function AsociacionPagos() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Cliente[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [saldoActual, setSaldoActual] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  // Facturas pendientes
  const [facturasPendientes, setFacturasPendientes] = useState<Venta[]>([]);
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

      // Fetch ventas with pending balance (ventas where total > sum of associated payments)
      // For simplicity, we get all ventas and calculate pending balance client-side
      const { data: ventas } = await supabase
        .from('ventas')
        .select('id, numero_comprobante, fecha, total')
        .eq('cliente_id', clienteId)
        .eq('anulada', false)
        .order('fecha', { ascending: false });

      // Fetch payments already associated to each venta
      const { data: pagosAsociados } = await supabase
        .from('cliente_movimientos')
        .select('venta_id, monto')
        .eq('cliente_id', clienteId)
        .in('tipo', ['pago', 'nota_credito', 'devolucion'])
        .not('venta_id', 'is', null);

      // Calculate pending balance per venta
      const pagoPorVenta = new Map<string, number>();
      pagosAsociados?.forEach(p => {
        if (p.venta_id) {
          pagoPorVenta.set(p.venta_id, (pagoPorVenta.get(p.venta_id) || 0) + Number(p.monto));
        }
      });

      const ventasConSaldo = (ventas || [])
        .map(v => ({
          ...v,
          saldo_pendiente: v.total - (pagoPorVenta.get(v.id) || 0)
        }))
        .filter(v => v.saldo_pendiente > 0);

      setFacturasPendientes(ventasConSaldo);

      // Fetch available payments (not associated to any venta)
      const { data: pagos } = await supabase
        .from('cliente_movimientos')
        .select('id, fecha, monto, concepto, forma_pago_id, formas_pago(nombre)')
        .eq('cliente_id', clienteId)
        .in('tipo', ['pago'])
        .is('venta_id', null)
        .eq('estado_imputacion', 'confirmado')
        .order('fecha', { ascending: false });

      setPagosDisponibles(pagos || []);
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

  const totalFacturasSeleccionadas = facturasPendientes
    .filter(f => selectedFacturas.has(f.id))
    .reduce((sum, f) => sum + f.saldo_pendiente, 0);

  const totalPagosSeleccionados = pagosDisponibles
    .filter(p => selectedPagos.has(p.id))
    .reduce((sum, p) => sum + Number(p.monto), 0);

  const handleAsociar = async () => {
    if (selectedFacturas.size === 0 || selectedPagos.size === 0) {
      toast.error('Selecciona al menos una factura y un pago');
      return;
    }

    setAssociating(true);
    try {
      // Simple association: link each selected payment to the first selected invoice
      // For more complex cases, we could split payments or distribute across invoices
      const facturaIds = Array.from(selectedFacturas);
      const pagoIds = Array.from(selectedPagos);
      
      // For now, associate all selected payments to the first selected invoice
      const targetFacturaId = facturaIds[0];
      const targetFactura = facturasPendientes.find(f => f.id === targetFacturaId);

      for (const pagoId of pagoIds) {
        const pago = pagosDisponibles.find(p => p.id === pagoId);
        const conceptoActualizado = `${pago?.concepto || 'Pago'} - Imputado a Fact. #${targetFactura?.numero_comprobante}`;

        const { error } = await supabase
          .from('cliente_movimientos')
          .update({
            venta_id: targetFacturaId,
            concepto: conceptoActualizado
          })
          .eq('id', pagoId);

        if (error) throw error;
      }

      toast.success('Pagos asociados correctamente');
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
        description="Vincular pagos disponibles con facturas pendientes"
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

        {/* Two column layout */}
        {selectedCliente && !loading && (
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
                              <p className="font-medium">
                                Factura #{factura.numero_comprobante}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {formatDate(factura.fecha)} · Total: {formatCurrency(factura.total)}
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
                    No hay pagos sin asociar
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
                              </p>
                            </div>
                            <Badge variant="outline" className="text-primary">
                              {formatCurrency(Number(pago.monto))}
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
        )}

        {/* Action button */}
        {selectedCliente && !loading && (selectedFacturas.size > 0 || selectedPagos.size > 0) && (
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

        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </div>
    </MainLayout>
  );
}
