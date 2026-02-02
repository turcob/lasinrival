import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Plus, Target, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ObjetivoVendedor } from '@/hooks/useVisitas';

interface ObjetivosVendedorTabProps {
  objetivos: ObjetivoVendedor[];
  vendedores: { id: string; nombre: string; codigo: string }[];
  mes: number;
  anio: number;
}

export function ObjetivosVendedorTab({ objetivos, vendedores, mes, anio }: ObjetivosVendedorTabProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedVendedor, setSelectedVendedor] = useState('');
  const [metaVentas, setMetaVentas] = useState('');
  const [metaVisitas, setMetaVisitas] = useState('');
  const [metaCobertura, setMetaCobertura] = useState('');
  const [metaTicket, setMetaTicket] = useState('');
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const crearObjetivo = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('objetivos_vendedor').insert({
        vendedor_id: selectedVendedor,
        periodo_mes: mes,
        periodo_anio: anio,
        meta_ventas: parseFloat(metaVentas) || 0,
        meta_visitas: parseInt(metaVisitas) || 0,
        meta_cobertura_porcentaje: parseFloat(metaCobertura) || 0,
        meta_ticket_promedio: parseFloat(metaTicket) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objetivos_vendedor'] });
      toast({ title: 'Objetivo creado' });
      setSheetOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: 'Error al crear objetivo', variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setSelectedVendedor('');
    setMetaVentas('');
    setMetaVisitas('');
    setMetaCobertura('');
    setMetaTicket('');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  };

  const vendedoresConObjetivo = objetivos.map(o => o.vendedor_id);
  const vendedoresSinObjetivo = vendedores.filter(v => !vendedoresConObjetivo.includes(v.id));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          Objetivos por Vendedor - {mes}/{anio}
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
              <SheetTitle>Crear Objetivo de Vendedor</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Vendedor</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedVendedor}
                  onChange={(e) => setSelectedVendedor(e.target.value)}
                >
                  <option value="">Seleccionar vendedor</option>
                  {vendedoresSinObjetivo.map((v) => (
                    <option key={v.id} value={v.id}>{v.nombre}</option>
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
                <Label>Meta de Cobertura (%)</Label>
                <Input
                  type="number"
                  value={metaCobertura}
                  onChange={(e) => setMetaCobertura(e.target.value)}
                  placeholder="0"
                  max={100}
                />
              </div>
              <div>
                <Label>Meta Ticket Promedio ($)</Label>
                <Input
                  type="number"
                  value={metaTicket}
                  onChange={(e) => setMetaTicket(e.target.value)}
                  placeholder="0"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => crearObjetivo.mutate()}
                disabled={!selectedVendedor || crearObjetivo.isPending}
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
            <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay objetivos definidos para este período</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {objetivos.map((obj) => {
            const ventasProgress = obj.meta_ventas > 0 ? (obj.ventas_realizadas / obj.meta_ventas) * 100 : 0;
            const visitasProgress = obj.meta_visitas > 0 ? (obj.visitas_realizadas / obj.meta_visitas) * 100 : 0;

            return (
              <Card key={obj.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{obj.vendedor?.nombre || 'Vendedor'}</CardTitle>
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

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-muted rounded p-2 text-center">
                      <p className="text-muted-foreground">Cobertura</p>
                      <p className="font-bold text-lg">{obj.cobertura_actual}%</p>
                      <p className="text-xs text-muted-foreground">Meta: {obj.meta_cobertura_porcentaje}%</p>
                    </div>
                    <div className="bg-muted rounded p-2 text-center">
                      <p className="text-muted-foreground">Ticket Prom.</p>
                      <p className="font-bold text-lg">{formatCurrency(obj.ticket_promedio_actual)}</p>
                      <p className="text-xs text-muted-foreground">Meta: {formatCurrency(obj.meta_ticket_promedio)}</p>
                    </div>
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
