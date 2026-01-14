import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { KPICard } from '@/components/shared/KPICard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  DollarSign, 
  ShoppingCart, 
  TrendingUp,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface DashboardStats {
  ventasHoy: number;
  ventasSemana: number;
  ventasMes: number;
  ventasCountHoy: number;
  ventasCountSemana: number;
}

const CHART_COLORS = ['hsl(217, 91%, 50%)', 'hsl(173, 80%, 40%)', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)'];

export default function Dashboard() {
  const { profile, user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    ventasHoy: 0,
    ventasSemana: 0,
    ventasMes: 0,
    ventasCountHoy: 0,
    ventasCountSemana: 0,
  });
  const [loading, setLoading] = useState(true);
  const [ventasPorDia, setVentasPorDia] = useState<{ dia: string; total: number }[]>([]);
  const [ventasPorFormaPago, setVentasPorFormaPago] = useState<{ nombre: string; total: number }[]>([]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;
    
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      
      // Calculate start of week (Monday)
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday).toISOString();
      
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Fetch only current user's sales
      const [
        ventasHoyRes,
        ventasSemanaRes,
        ventasMesRes,
      ] = await Promise.all([
        supabase.from('ventas').select('total').gte('fecha', startOfDay).eq('anulada', false).eq('usuario_id', user.id),
        supabase.from('ventas').select('total').gte('fecha', startOfWeek).eq('anulada', false).eq('usuario_id', user.id),
        supabase.from('ventas').select('total').gte('fecha', startOfMonth).eq('anulada', false).eq('usuario_id', user.id),
      ]);

      setStats({
        ventasHoy: ventasHoyRes.data?.reduce((sum, v) => sum + (v.total || 0), 0) || 0,
        ventasSemana: ventasSemanaRes.data?.reduce((sum, v) => sum + (v.total || 0), 0) || 0,
        ventasMes: ventasMesRes.data?.reduce((sum, v) => sum + (v.total || 0), 0) || 0,
        ventasCountHoy: ventasHoyRes.data?.length || 0,
        ventasCountSemana: ventasSemanaRes.data?.length || 0,
      });

      // Fetch sales by day for the current week (user's sales only)
      const ventasSemanaData = ventasSemanaRes.data || [];
      const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
      
      // We need to fetch with fecha to group by day
      const { data: ventasConFecha } = await supabase
        .from('ventas')
        .select('total, fecha')
        .gte('fecha', startOfWeek)
        .eq('anulada', false)
        .eq('usuario_id', user.id);

      const ventasPorDiaMap: Record<string, number> = {};
      diasSemana.forEach(dia => ventasPorDiaMap[dia] = 0);
      
      (ventasConFecha || []).forEach(venta => {
        if (venta.fecha) {
          const fecha = new Date(venta.fecha);
          const diaSemana = fecha.getDay();
          const diaIndex = diaSemana === 0 ? 6 : diaSemana - 1;
          ventasPorDiaMap[diasSemana[diaIndex]] += venta.total || 0;
        }
      });

      setVentasPorDia(diasSemana.map(dia => ({ dia, total: ventasPorDiaMap[dia] })));

      // Fetch sales by payment method (user's sales only)
      const { data: pagosData } = await supabase
        .from('venta_pagos')
        .select(`
          monto,
          forma_pago_id,
          formas_pago!inner(nombre),
          ventas!inner(usuario_id, anulada)
        `)
        .eq('ventas.usuario_id', user.id)
        .eq('ventas.anulada', false);

      const pagosPorForma: Record<string, number> = {};
      (pagosData || []).forEach((pago: any) => {
        const nombre = pago.formas_pago?.nombre || 'Otro';
        pagosPorForma[nombre] = (pagosPorForma[nombre] || 0) + (pago.monto || 0);
      });

      setVentasPorFormaPago(
        Object.entries(pagosPorForma)
          .map(([nombre, total]) => ({ nombre, total }))
          .sort((a, b) => b.total - a.total)
      );

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <MainLayout>
      <PageHeader 
        title={`¡Hola, ${profile?.nombre || 'Usuario'}!`}
        description="Aquí tienes un resumen de tus ventas"
      />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <KPICard
          title="Ventas del Día"
          value={formatCurrency(stats.ventasHoy)}
          icon={<DollarSign className="h-6 w-6" />}
          description={`${stats.ventasCountHoy} venta${stats.ventasCountHoy !== 1 ? 's' : ''}`}
        />
        <KPICard
          title="Ventas de la Semana"
          value={formatCurrency(stats.ventasSemana)}
          icon={<TrendingUp className="h-6 w-6" />}
          description={`${stats.ventasCountSemana} venta${stats.ventasCountSemana !== 1 ? 's' : ''}`}
        />
        <KPICard
          title="Ventas del Mes"
          value={formatCurrency(stats.ventasMes)}
          icon={<ShoppingCart className="h-6 w-6" />}
        />
        <KPICard
          title="Promedio por Venta"
          value={formatCurrency(stats.ventasCountSemana > 0 ? stats.ventasSemana / stats.ventasCountSemana : 0)}
          icon={<DollarSign className="h-6 w-6" />}
          description="Esta semana"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sales by Day */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">Tus Ventas por Día (Esta Semana)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ventasPorDia}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="dia" className="text-xs" />
                  <YAxis 
                    className="text-xs"
                    tickFormatter={(value) => value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${value}`}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Total']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar 
                    dataKey="total" 
                    fill="hsl(217, 91%, 50%)" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Sales by Payment Method */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">Tus Ventas por Forma de Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {ventasPorFormaPago.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ventasPorFormaPago}
                      dataKey="total"
                      nameKey="nombre"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ nombre, percent }) => `${nombre} ${(percent * 100).toFixed(0)}%`}
                    >
                      {ventasPorFormaPago.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Total']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No hay ventas registradas
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}