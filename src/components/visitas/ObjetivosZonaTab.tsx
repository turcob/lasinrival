import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Plus, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ObjetivoZona } from '@/hooks/useVisitas';

interface ObjetivosZonaTabProps {
  objetivos: ObjetivoZona[];
  mes: number;
  anio: number;
}

export function ObjetivosZonaTab({ objetivos, mes, anio }: ObjetivosZonaTabProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedZona, setSelectedZona] = useState('');
  const [metaVentas, setMetaVentas] = useState('');
  const [metaVisitas, setMetaVisitas] = useState('');
  const [metaClientesNuevos, setMetaClientesNuevos] = useState('');
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: zonas = [] } = useQuery({
    queryKey: ['zonas-activas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zonas')
        .select('id, nombre, codigo')
        .eq('activo', true)
        .order('nombre');
      if (error) throw error;
      return data;
    },
  });

  const crearObjetivo = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('objetivos_zona').insert({
        zona_id: selectedZona,
        periodo_mes: mes,
        periodo_anio: anio,
        meta_ventas: parseFloat(metaVentas) || 0,
        meta_visitas: parseInt(metaVisitas) || 0,
        meta_clientes_nuevos: parseInt(metaClientesNuevos) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objetivos_zona'] });
      toast({ title: 'Objetivo creado' });
      setSheetOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: 'Error al crear objetivo', variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setSelectedZona('');
    setMetaVentas('');
    setMetaVisitas('');
    setMetaClientesNuevos('');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  };

  const zonasConObjetivo = objetivos.map(o => o.zona_id);
  const zonasSinObjetivo = zonas.filter(z => !zonasConObjetivo.includes(z.id));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          Objetivos por Zona - {mes}/{anio}
        </h3>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Objetivo
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Crear Objetivo de Zona</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Zona</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedZona}
                  onChange={(e) => setSelectedZona(e.target.value)}
                >
                  <option value="">Seleccionar zona</option>
                  {zonasSinObjetivo.map((z) => (
                    <option key={z.id} value={z.id}>{z.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Meta de Ventas ($)</Label>
                <Input
                  type="number"
                  value={metaVentas}
                  onChange={(e) => setMetaVentas(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Meta de Visitas</Label>
                <Input
                  type="number"
                  value={metaVisitas}
                  onChange={(e) => setMetaVisitas(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Meta Clientes Nuevos</Label>
                <Input
                  type="number"
                  value={metaClientesNuevos}
                  onChange={(e) => setMetaClientesNuevos(e.target.value)}
                  placeholder="0"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => crearObjetivo.mutate()}
                disabled={!selectedZona || crearObjetivo.isPending}
              >
                Crear Objetivo
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {objetivos.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay objetivos por zona definidos para este período</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {objetivos.map((obj) => {
            const ventasProgress = obj.meta_ventas > 0 ? (obj.ventas_realizadas / obj.meta_ventas) * 100 : 0;
            const visitasProgress = obj.meta_visitas > 0 ? (obj.visitas_realizadas / obj.meta_visitas) * 100 : 0;

            return (
              <Card key={obj.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {obj.zona?.nombre || 'Zona'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Ventas</span>
                      <span className="font-medium">
                        {formatCurrency(obj.ventas_realizadas)} / {formatCurrency(obj.meta_ventas)}
                      </span>
                    </div>
                    <Progress value={Math.min(ventasProgress, 100)} className="h-2" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Visitas</span>
                      <span className="font-medium">
                        {obj.visitas_realizadas} / {obj.meta_visitas}
                      </span>
                    </div>
                    <Progress value={Math.min(visitasProgress, 100)} className="h-2" />
                  </div>

                  <div className="bg-muted rounded p-2 text-center">
                    <p className="text-muted-foreground text-sm">Clientes Nuevos</p>
                    <p className="font-bold text-lg">{obj.clientes_nuevos} / {obj.meta_clientes_nuevos}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
