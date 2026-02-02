import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Target, Package, Users, TrendingUp, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useVisitas, useObjetivosVendedor, useObjetivosZona, useProductosFoco, useVisitaMutations } from '@/hooks/useVisitas';
import { VisitaCard } from '@/components/visitas/VisitaCard';
import { ObjetivosVendedorTab } from '@/components/visitas/ObjetivosVendedorTab';
import { ObjetivosZonaTab } from '@/components/visitas/ObjetivosZonaTab';
import { ProductosFocoTab } from '@/components/visitas/ProductosFocoTab';

export default function AgendaVisitas() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedVendedor, setSelectedVendedor] = useState<string>('');
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const { data: vendedores = [] } = useQuery({
    queryKey: ['vendedores-activos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendedores')
        .select('id, nombre, codigo')
        .eq('activo', true)
        .order('nombre');
      if (error) throw error;
      return data;
    },
  });

  const { data: visitas = [], isLoading: loadingVisitas } = useVisitas(selectedDate, selectedVendedor || undefined);
  const { data: objetivosVendedor = [] } = useObjetivosVendedor(currentMonth, currentYear);
  const { data: objetivosZona = [] } = useObjetivosZona(currentMonth, currentYear);
  const { data: productosFoco = [] } = useProductosFoco(currentMonth, currentYear);
  const { generarVisitas } = useVisitaMutations();

  const visitasPendientes = visitas.filter(v => v.estado === 'pendiente').length;
  const visitasCompletadas = visitas.filter(v => v.estado === 'completada').length;
  const visitasNoRealizadas = visitas.filter(v => v.estado === 'no_visitado').length;

  const handleGenerarVisitas = () => {
    if (!selectedVendedor) return;
    generarVisitas.mutate({ vendedorId: selectedVendedor, fecha: selectedDate });
  };

  return (
    <MainLayout>
      <PageHeader
        title="Agenda de Visitas"
        description="Gestión de recorridos, check-in GPS y objetivos comerciales"
      />

      <div className="space-y-6">
        {/* KPIs del día */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-100 text-yellow-700">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{visitasPendientes}</p>
                  <p className="text-sm text-muted-foreground">Pendientes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 text-green-700">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{visitasCompletadas}</p>
                  <p className="text-sm text-muted-foreground">Completadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 text-red-700">
                  <XCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{visitasNoRealizadas}</p>
                  <p className="text-sm text-muted-foreground">No visitados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {visitas.length > 0 ? Math.round((visitasCompletadas / visitas.length) * 100) : 0}%
                  </p>
                  <p className="text-sm text-muted-foreground">Cobertura</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="agenda" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="agenda" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Agenda</span>
            </TabsTrigger>
            <TabsTrigger value="objetivos-vendedor" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Obj. Vendedor</span>
            </TabsTrigger>
            <TabsTrigger value="objetivos-zona" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Obj. Zona</span>
            </TabsTrigger>
            <TabsTrigger value="productos-foco" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Prod. Foco</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="agenda" className="space-y-4">
            {/* Filtros */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[150px]">
                    <Label>Fecha</Label>
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <Label>Vendedor</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={selectedVendedor}
                      onChange={(e) => setSelectedVendedor(e.target.value)}
                    >
                      <option value="">Todos los vendedores</option>
                      {vendedores.map((v) => (
                        <option key={v.id} value={v.id}>{v.nombre}</option>
                      ))}
                    </select>
                  </div>
                  {selectedVendedor && (
                    <Button
                      onClick={handleGenerarVisitas}
                      disabled={generarVisitas.isPending}
                    >
                      <Target className="h-4 w-4 mr-2" />
                      Generar Visitas
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Lista de visitas */}
            {loadingVisitas ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : visitas.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay visitas programadas para esta fecha</p>
                  {selectedVendedor && (
                    <p className="text-sm mt-2">Puedes generar visitas automáticas basadas en los clientes del vendedor</p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {visitas.map((visita) => (
                  <VisitaCard key={visita.id} visita={visita} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="objetivos-vendedor">
            <ObjetivosVendedorTab 
              objetivos={objetivosVendedor} 
              vendedores={vendedores}
              mes={currentMonth}
              anio={currentYear}
            />
          </TabsContent>

          <TabsContent value="objetivos-zona">
            <ObjetivosZonaTab 
              objetivos={objetivosZona}
              mes={currentMonth}
              anio={currentYear}
            />
          </TabsContent>

          <TabsContent value="productos-foco">
            <ProductosFocoTab 
              productosFoco={productosFoco}
              mes={currentMonth}
              anio={currentYear}
            />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
