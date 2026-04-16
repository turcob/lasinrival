import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Plus, Pencil, Trash2, MapPin, CalendarDays, Truck, ClipboardList } from 'lucide-react';

const DIAS_SEMANA = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];

const getDiaNombre = (dia: number) => DIAS_SEMANA.find(d => d.value === dia)?.label || '-';

interface HorarioForm {
  zona_id: string;
  dia_semana: number;
  tipo: 'entrega' | 'pedido';
  turno_nombre: string;
  hora_desde: string;
  hora_hasta: string;
  capacidad_maxima: number;
}

const defaultForm: HorarioForm = {
  zona_id: '',
  dia_semana: 1,
  tipo: 'entrega',
  turno_nombre: 'General',
  hora_desde: '08:00',
  hora_hasta: '18:00',
  capacidad_maxima: 0,
};

function useZonas() {
  return useQuery({
    queryKey: ['zonas-horarios'],
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
}

function useHorarios(zonaId: string | null) {
  return useQuery({
    queryKey: ['zona-horarios', zonaId],
    queryFn: async () => {
      let query = supabase
        .from('zona_horarios')
        .select('*, zona:zonas(id, nombre)')
        .order('dia_semana')
        .order('tipo')
        .order('turno_nombre');
      if (zonaId) {
        query = query.eq('zona_id', zonaId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export default function HorariosZona() {
  const [zonaFiltro, setZonaFiltro] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<HorarioForm>(defaultForm);
  const [tipoTab, setTipoTab] = useState<string>('entrega');

  const { toast } = useToast();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const queryClient = useQueryClient();

  const { data: zonas } = useZonas();
  const { data: horarios, isLoading } = useHorarios(zonaFiltro);

  const horariosFiltrados = useMemo(() => {
    if (!horarios) return [];
    return horarios.filter((h: any) => h.tipo === tipoTab);
  }, [horarios, tipoTab]);

  // Group by zona for display
  const horariosPorZona = useMemo(() => {
    const map = new Map<string, { zonaNombre: string; items: any[] }>();
    for (const h of horariosFiltrados) {
      const key = h.zona_id;
      if (!map.has(key)) {
        map.set(key, { zonaNombre: (h as any).zona?.nombre || '-', items: [] });
      }
      map.get(key)!.items.push(h);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].zonaNombre.localeCompare(b[1].zonaNombre));
  }, [horariosFiltrados]);

  const guardarMutation = useMutation({
    mutationFn: async () => {
      if (!form.zona_id) throw new Error('Seleccione una zona');

      const payload = {
        zona_id: form.zona_id,
        dia_semana: form.dia_semana,
        tipo: form.tipo,
        turno_nombre: form.turno_nombre,
        hora_desde: form.hora_desde || null,
        hora_hasta: form.hora_hasta || null,
        capacidad_maxima: form.capacidad_maxima,
      };

      if (editingId) {
        const { error } = await supabase
          .from('zona_horarios')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('zona_horarios')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zona-horarios'] });
      toast({ title: editingId ? 'Horario actualizado' : 'Horario creado' });
      setDialogOpen(false);
      setEditingId(null);
      setForm(defaultForm);
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const eliminarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('zona_horarios').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zona-horarios'] });
      toast({ title: 'Horario eliminado' });
      setDeleteId(null);
    },
  });

  const toggleActivoMutation = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => {
      const { error } = await supabase.from('zona_horarios').update({ activo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zona-horarios'] });
    },
  });

  const handleEditar = (horario: any) => {
    setEditingId(horario.id);
    setForm({
      zona_id: horario.zona_id,
      dia_semana: horario.dia_semana,
      tipo: horario.tipo,
      turno_nombre: horario.turno_nombre,
      hora_desde: horario.hora_desde || '08:00',
      hora_hasta: horario.hora_hasta || '18:00',
      capacidad_maxima: horario.capacidad_maxima || 0,
    });
    setDialogOpen(true);
  };

  const handleNuevo = () => {
    setEditingId(null);
    setForm({ ...defaultForm, tipo: tipoTab as 'entrega' | 'pedido', zona_id: zonaFiltro || '' });
    setDialogOpen(true);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Horarios y Turnos por Zona"
          description="Configurá los días y horarios de pedidos y entregas por zona"
        />

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <Select value={zonaFiltro || 'todas'} onValueChange={v => setZonaFiltro(v === 'todas' ? null : v)}>
            <SelectTrigger className="w-[250px]">
              <MapPin className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filtrar por zona" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las zonas</SelectItem>
              {zonas?.map(z => (
                <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isAdmin && (
            <Button onClick={handleNuevo}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Horario
            </Button>
          )}
        </div>

        <Tabs value={tipoTab} onValueChange={setTipoTab}>
          <TabsList>
            <TabsTrigger value="entrega" className="gap-2">
              <Truck className="h-4 w-4" />
              Días de Entrega
            </TabsTrigger>
            <TabsTrigger value="pedido" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Días de Pedido
            </TabsTrigger>
          </TabsList>

          <TabsContent value={tipoTab} className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : horariosPorZona.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No hay horarios configurados{tipoTab === 'entrega' ? ' de entrega' : ' de pedido'}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {horariosPorZona.map(([zonaId, { zonaNombre, items }]) => (
                  <div key={zonaId} className="border rounded-lg overflow-hidden">
                    <div className="bg-muted px-4 py-2 flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span className="font-semibold">{zonaNombre}</span>
                      <Badge variant="secondary" className="ml-auto">{items.length} turnos</Badge>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Día</TableHead>
                          <TableHead>Turno</TableHead>
                          <TableHead>Horario</TableHead>
                          <TableHead className="text-center">Capacidad</TableHead>
                          <TableHead className="text-center">Activo</TableHead>
                          {isAdmin && <TableHead className="text-right">Acciones</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((h: any) => (
                          <TableRow key={h.id} className={!h.activo ? 'opacity-50' : ''}>
                            <TableCell className="font-medium">{getDiaNombre(h.dia_semana)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{h.turno_nombre}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm">
                                <Clock className="h-3 w-3" />
                                {h.hora_desde?.slice(0, 5) || '-'} - {h.hora_hasta?.slice(0, 5) || '-'}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {h.capacidad_maxima > 0 ? (
                                <Badge>{h.capacidad_maxima}</Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">Sin límite</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {isAdmin ? (
                                <Switch
                                  checked={h.activo}
                                  onCheckedChange={(checked) => toggleActivoMutation.mutate({ id: h.id, activo: checked })}
                                />
                              ) : (
                                <Badge variant={h.activo ? 'default' : 'secondary'}>
                                  {h.activo ? 'Sí' : 'No'}
                                </Badge>
                              )}
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditar(h)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(h.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog crear/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Horario' : 'Nuevo Horario'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Zona *</Label>
              <Select value={form.zona_id} onValueChange={v => setForm({ ...form, zona_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar zona" />
                </SelectTrigger>
                <SelectContent>
                  {zonas?.map(z => (
                    <SelectItem key={z.id} value={z.id}>{z.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v as 'entrega' | 'pedido' })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrega">Entrega</SelectItem>
                    <SelectItem value="pedido">Pedido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Día *</Label>
                <Select value={form.dia_semana.toString()} onValueChange={v => setForm({ ...form, dia_semana: parseInt(v) })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIAS_SEMANA.map(d => (
                      <SelectItem key={d.value} value={d.value.toString()}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nombre del Turno</Label>
              <Input
                value={form.turno_nombre}
                onChange={e => setForm({ ...form, turno_nombre: e.target.value })}
                placeholder="Ej: Mañana, Tarde, General"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hora Desde</Label>
                <Input
                  type="time"
                  value={form.hora_desde}
                  onChange={e => setForm({ ...form, hora_desde: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Hora Hasta</Label>
                <Input
                  type="time"
                  value={form.hora_hasta}
                  onChange={e => setForm({ ...form, hora_hasta: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Capacidad Máxima (0 = sin límite)</Label>
              <Input
                type="number"
                min="0"
                value={form.capacidad_maxima}
                onChange={e => setForm({ ...form, capacidad_maxima: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => guardarMutation.mutate()} disabled={guardarMutation.isPending}>
              {guardarMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminación */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar horario?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && eliminarMutation.mutate(deleteId)}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
