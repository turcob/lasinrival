import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { toast } from 'sonner';
import { Download, CheckCircle, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Empleado {
  id: string;
  nombre: string;
  sueldo_base: number;
  activo: boolean;
}

interface LiquidacionData {
  empleado: Empleado;
  sueldo_base: number;
  total_compras: number;
  total_adelantos: number;
  total_comisiones: number;
  neto_a_pagar: number;
  liquidacion_existente?: {
    id: string;
    estado: string;
  };
}

interface LiquidacionSectionProps {
  empleados: Empleado[];
  onRefresh: () => void;
}

const MESES = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

export function LiquidacionSection({ empleados, onRefresh }: LiquidacionSectionProps) {
  const { user } = useAuth();
  const [selectedMes, setSelectedMes] = useState(new Date().getMonth() + 1);
  const [selectedAnio, setSelectedAnio] = useState(new Date().getFullYear());
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  useEffect(() => {
    calcularLiquidaciones();
  }, [selectedMes, selectedAnio, empleados]);

  const calcularLiquidaciones = async () => {
    setLoading(true);
    try {
      const empleadosActivos = empleados.filter(e => e.activo);
      
      // Get date range for the selected month
      const startDate = `${selectedAnio}-${String(selectedMes).padStart(2, '0')}-01`;
      const endDate = new Date(selectedAnio, selectedMes, 0).toISOString().split('T')[0];

      // Fetch movimientos for the period
      const { data: movimientos } = await supabase
        .from('empleado_movimientos')
        .select('*')
        .gte('fecha', startDate)
        .lte('fecha', endDate);

      // Fetch existing liquidaciones
      const { data: liquidacionesExistentes } = await supabase
        .from('empleado_liquidaciones')
        .select('*')
        .eq('mes', selectedMes)
        .eq('anio', selectedAnio);

      const liquidacionesData: LiquidacionData[] = empleadosActivos.map(emp => {
        const empMovimientos = movimientos?.filter(m => m.empleado_id === emp.id) || [];
        
        const total_compras = empMovimientos
          .filter(m => m.tipo === 'compra')
          .reduce((sum, m) => sum + Number(m.monto), 0);
        
        const total_adelantos = empMovimientos
          .filter(m => m.tipo === 'adelanto')
          .reduce((sum, m) => sum + Number(m.monto), 0);
        
        const total_comisiones = empMovimientos
          .filter(m => m.tipo === 'comision')
          .reduce((sum, m) => sum + Number(m.monto), 0);

        const sueldo_base = Number(emp.sueldo_base) || 0;
        const neto_a_pagar = sueldo_base + total_comisiones - total_compras - total_adelantos;

        const liquidacion_existente = liquidacionesExistentes?.find(l => l.empleado_id === emp.id);

        return {
          empleado: emp,
          sueldo_base,
          total_compras,
          total_adelantos,
          total_comisiones,
          neto_a_pagar,
          liquidacion_existente: liquidacion_existente ? {
            id: liquidacion_existente.id,
            estado: liquidacion_existente.estado,
          } : undefined,
        };
      });

      setLiquidaciones(liquidacionesData);
    } catch (error) {
      console.error('Error calculating liquidaciones:', error);
      toast.error('Error al calcular liquidaciones');
    } finally {
      setLoading(false);
    }
  };

  const generarLiquidacion = async (data: LiquidacionData) => {
    if (!user) return;
    setProcessingId(data.empleado.id);

    try {
      // Create liquidacion record
      const { error: liqError } = await supabase.from('empleado_liquidaciones').insert([{
        empleado_id: data.empleado.id,
        mes: selectedMes,
        anio: selectedAnio,
        sueldo_base: data.sueldo_base,
        total_descuentos: data.total_compras + data.total_adelantos,
        total_comisiones: data.total_comisiones,
        neto_a_pagar: data.neto_a_pagar,
        estado: 'pendiente',
        usuario_id: user.id,
      }]);

      if (liqError) {
        if (liqError.code === '23505') {
          toast.error('Ya existe una liquidación para este empleado en este período');
        } else {
          throw liqError;
        }
        return;
      }

      // Create liquidacion movement to clear the account
      if (data.total_compras + data.total_adelantos > 0) {
        await supabase.from('empleado_movimientos').insert([{
          empleado_id: data.empleado.id,
          tipo: 'liquidacion',
          monto: data.total_compras + data.total_adelantos,
          concepto: `Liquidación ${MESES.find(m => m.value === selectedMes)?.label} ${selectedAnio}`,
          fecha: new Date().toISOString().split('T')[0],
          usuario_registro_id: user.id,
        }]);
      }

      toast.success('Liquidación generada correctamente');
      calcularLiquidaciones();
      onRefresh();
    } catch (error) {
      console.error('Error generating liquidacion:', error);
      toast.error('Error al generar la liquidación');
    } finally {
      setProcessingId(null);
    }
  };

  const marcarPagada = async (liquidacionId: string) => {
    try {
      const { error } = await supabase
        .from('empleado_liquidaciones')
        .update({ estado: 'pagada', fecha_pago: new Date().toISOString().split('T')[0] })
        .eq('id', liquidacionId);

      if (error) throw error;
      toast.success('Liquidación marcada como pagada');
      calcularLiquidaciones();
    } catch (error) {
      console.error('Error updating liquidacion:', error);
      toast.error('Error al actualizar la liquidación');
    }
  };

  const exportarExcel = () => {
    const data = liquidaciones.map(l => ({
      'Empleado': l.empleado.nombre,
      'Sueldo Base': l.sueldo_base,
      'Compras': l.total_compras,
      'Adelantos': l.total_adelantos,
      'Comisiones': l.total_comisiones,
      'Neto a Pagar': l.neto_a_pagar,
      'Estado': l.liquidacion_existente?.estado || 'Sin generar',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Liquidaciones');
    XLSX.writeFile(wb, `Liquidaciones_${MESES.find(m => m.value === selectedMes)?.label}_${selectedAnio}.xlsx`);
    toast.success('Archivo exportado correctamente');
  };

  const totalNeto = liquidaciones.reduce((sum, l) => sum + l.neto_a_pagar, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Liquidación de Sueldos
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={String(selectedMes)} onValueChange={(v) => setSelectedMes(Number(v))}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESES.map((mes) => (
                  <SelectItem key={mes.value} value={String(mes.value)}>
                    {mes.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(selectedAnio)} onValueChange={(v) => setSelectedAnio(Number(v))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportarExcel}>
              <Download className="h-4 w-4 mr-1" />
              Excel
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : liquidaciones.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No hay empleados activos para liquidar
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead className="text-right">Sueldo Base</TableHead>
                  <TableHead className="text-right">Compras</TableHead>
                  <TableHead className="text-right">Adelantos</TableHead>
                  <TableHead className="text-right">Comisiones</TableHead>
                  <TableHead className="text-right">Neto a Pagar</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liquidaciones.map((liq) => (
                  <TableRow key={liq.empleado.id}>
                    <TableCell className="font-medium">{liq.empleado.nombre}</TableCell>
                    <TableCell className="text-right">
                      ${liq.sueldo_base.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-destructive">
                      -${liq.total_compras.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-destructive">
                      -${liq.total_adelantos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      +${liq.total_comisiones.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      ${liq.neto_a_pagar.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      {liq.liquidacion_existente ? (
                        <Badge variant={liq.liquidacion_existente.estado === 'pagada' ? 'default' : 'secondary'}>
                          {liq.liquidacion_existente.estado === 'pagada' ? 'Pagada' : 'Pendiente'}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Sin generar</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!liq.liquidacion_existente ? (
                        <Button 
                          size="sm" 
                          onClick={() => generarLiquidacion(liq)}
                          disabled={processingId === liq.empleado.id}
                        >
                          {processingId === liq.empleado.id ? 'Generando...' : 'Generar'}
                        </Button>
                      ) : liq.liquidacion_existente.estado === 'pendiente' ? (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => marcarPagada(liq.liquidacion_existente!.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Marcar Pagada
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">✓ Completada</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-4 pt-4 border-t flex justify-end">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total Neto a Pagar</p>
                <p className="text-2xl font-bold">
                  ${totalNeto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
