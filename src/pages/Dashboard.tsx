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
  Package, 
  Users,
  TrendingUp,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
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
  totalProductos: number;
  totalClientes: number;
  ventasCount: number;
}

const CHART_COLORS = ['hsl(217, 91%, 50%)', 'hsl(173, 80%, 40%)', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)'];

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    ventasHoy: 0,
    ventasSemana: 0,
    ventasMes: 0,
    totalProductos: 0,
    totalClientes: 0,
    ventasCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [ventasPorDia, setVentasPorDia] = useState<{ dia: string; total: number }[]>([]);
  const [ventasPorFormaPago, setVentasPorFormaPago] = useState<{ nombre: string; total: number }[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay())).toISOString();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

      const [
        ventasHoyRes,
        ventasSemanaRes,
        ventasMesRes,
        productosRes,
        clientesRes,
        ventasCountRes,
      ] = await Promise.all([
        supabase.from('ventas').select('total').gte('fecha', startOfDay).eq('anulada', false),
        supabase.from('ventas').select('total').gte('fecha', startOfWeek).eq('anulada', false),
        supabase.from('ventas').select('total').gte('fecha', startOfMonth).eq('anulada', false),
        supabase.from('productos').select('id', { count: 'exact', head: true }).eq('activo', true),
        supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('activo', true),
        supabase.from('ventas').select('id', { count: 'exact', head: true }).eq('anulada', false),
      ]);

      setStats({
        ventasHoy: ventasHoyRes.data?.reduce((sum, v) => sum + (v.total || 0), 0) || 0,
        ventasSemana: ventasSemanaRes.data?.reduce((sum, v) => sum + (v.total || 0), 0) || 0,
        ventasMes: ventasMesRes.data?.reduce((sum, v) => sum + (v.total || 0), 0) || 0,
        totalProductos: productosRes.count || 0,
        totalClientes: clientesRes.count || 0,
        ventasCount: ventasCountRes.count || 0,
      });

      // Simulated data for charts (would come from real queries)
      setVentasPorDia([
        { dia: 'Lun', total: 15000 },
        { dia: 'Mar', total: 22000 },
        { dia: 'Mié', total: 18000 },
        { dia: 'Jue', total: 25000 },
        { dia: 'Vie', total: 32000 },
        { dia: 'Sáb', total: 28000 },
        { dia: 'Dom', total: 12000 },
      ]);

      setVentasPorFormaPago([
        { nombre: 'Efectivo', total: 45000 },
        { nombre: 'Débito', total: 30000 },
        { nombre: 'Crédito', total: 20000 },
        { nombre: 'Transferencia', total: 15000 },
        { nombre: 'QR', total: 10000 },
      ]);

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
        description="Aquí tienes un resumen de tu negocio"
      />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <KPICard
          title="Ventas del Día"
          value={formatCurrency(stats.ventasHoy)}
          icon={<DollarSign className="h-6 w-6" />}
          trend={{ value: 12, label: 'vs ayer' }}
        />
        <KPICard
          title="Ventas de la Semana"
          value={formatCurrency(stats.ventasSemana)}
          icon={<TrendingUp className="h-6 w-6" />}
          trend={{ value: 8, label: 'vs semana ant.' }}
        />
        <KPICard
          title="Total Productos"
          value={stats.totalProductos.toLocaleString()}
          icon={<Package className="h-6 w-6" />}
        />
        <KPICard
          title="Total Clientes"
          value={stats.totalClientes.toLocaleString()}
          icon={<Users className="h-6 w-6" />}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        {/* Sales by Day */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">Ventas por Día</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ventasPorDia}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="dia" className="text-xs" />
                  <YAxis 
                    className="text-xs"
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
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
            <CardTitle className="text-lg font-semibold">Ventas por Forma de Pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
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
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link to="/pos">
              <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2">
                <ShoppingCart className="h-6 w-6 text-primary" />
                <span>Nueva Venta</span>
              </Button>
            </Link>
            <Link to="/productos">
              <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2">
                <Package className="h-6 w-6 text-primary" />
                <span>Ver Productos</span>
              </Button>
            </Link>
            <Link to="/clientes">
              <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2">
                <Users className="h-6 w-6 text-primary" />
                <span>Ver Clientes</span>
              </Button>
            </Link>
            <Link to="/reportes">
              <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2">
                <TrendingUp className="h-6 w-6 text-primary" />
                <span>Ver Reportes</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </MainLayout>
  );
}