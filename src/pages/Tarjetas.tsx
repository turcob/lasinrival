import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Edit, Trash2, CreditCard, ChevronDown, ChevronUp, Percent } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface Tarjeta {
  id: string;
  nombre: string;
  tipo: 'credito' | 'debito';
  activo: boolean;
}

interface TarjetaCuota {
  id: string;
  tarjeta_id: string;
  cuotas: number;
  coeficiente: number;
  activo: boolean;
}

export default function Tarjetas() {
  const { hasRole } = useAuth();
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>([]);
  const [cuotas, setCuotas] = useState<TarjetaCuota[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cuotaDialogOpen, setCuotaDialogOpen] = useState(false);
  const [editingTarjeta, setEditingTarjeta] = useState<Tarjeta | null>(null);
  const [editingCuota, setEditingCuota] = useState<TarjetaCuota | null>(null);
  const [selectedTarjetaId, setSelectedTarjetaId] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  
  const [formData, setFormData] = useState({
    nombre: '',
    tipo: 'credito' as 'credito' | 'debito',
  });
  
  const [cuotaFormData, setCuotaFormData] = useState({
    cuotas: 1,
    interes: 0, // Porcentaje de interés (ej: 5 para 5%)
  });

  const isAdmin = hasRole('admin');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tarjetasRes, cuotasRes] = await Promise.all([
        supabase.from('tarjetas').select('*').order('tipo').order('nombre'),
        supabase.from('tarjeta_cuotas').select('*').order('cuotas'),
      ]);

      if (tarjetasRes.data) setTarjetas(tarjetasRes.data as Tarjeta[]);
      if (cuotasRes.data) setCuotas(cuotasRes.data as TarjetaCuota[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar las tarjetas');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (tarjeta?: Tarjeta) => {
    if (tarjeta) {
      setEditingTarjeta(tarjeta);
      setFormData({
        nombre: tarjeta.nombre,
        tipo: tarjeta.tipo,
      });
    } else {
      setEditingTarjeta(null);
      setFormData({ nombre: '', tipo: 'credito' });
    }
    setDialogOpen(true);
  };

  const handleOpenCuotaDialog = (tarjetaId: string, cuota?: TarjetaCuota) => {
    setSelectedTarjetaId(tarjetaId);
    if (cuota) {
      setEditingCuota(cuota);
      setCuotaFormData({
        cuotas: cuota.cuotas,
        interes: (cuota.coeficiente - 1) * 100, // Convertir coeficiente a porcentaje
      });
    } else {
      setEditingCuota(null);
      setCuotaFormData({ cuotas: 1, interes: 0 });
    }
    setCuotaDialogOpen(true);
  };

  const handleSaveTarjeta = async () => {
    if (!formData.nombre.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    try {
      if (editingTarjeta) {
        const { error } = await supabase
          .from('tarjetas')
          .update({ nombre: formData.nombre.trim(), tipo: formData.tipo })
          .eq('id', editingTarjeta.id);
        if (error) throw error;
        toast.success('Tarjeta actualizada');
      } else {
        const { error } = await supabase
          .from('tarjetas')
          .insert({ nombre: formData.nombre.trim(), tipo: formData.tipo });
        if (error) throw error;
        toast.success('Tarjeta creada');
      }
      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error saving tarjeta:', error);
      toast.error('Error al guardar la tarjeta');
    }
  };

  const handleSaveCuota = async () => {
    if (!selectedTarjetaId) return;
    if (cuotaFormData.cuotas < 1) {
      toast.error('Las cuotas deben ser al menos 1');
      return;
    }
    if (cuotaFormData.interes < 0) {
      toast.error('El interés no puede ser negativo');
      return;
    }

    // Convertir porcentaje a coeficiente (5% -> 1.05)
    const coeficiente = 1 + (cuotaFormData.interes / 100);

    try {
      if (editingCuota) {
        const { error } = await supabase
          .from('tarjeta_cuotas')
          .update({ 
            cuotas: cuotaFormData.cuotas, 
            coeficiente: coeficiente 
          })
          .eq('id', editingCuota.id);
        if (error) throw error;
        toast.success('Configuración actualizada');
      } else {
        const { error } = await supabase
          .from('tarjeta_cuotas')
          .insert({ 
            tarjeta_id: selectedTarjetaId,
            cuotas: cuotaFormData.cuotas, 
            coeficiente: coeficiente 
          });
        if (error) throw error;
        toast.success('Configuración creada');
      }
      setCuotaDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error saving cuota:', error);
      if (error.code === '23505') {
        toast.error('Ya existe una configuración para esa cantidad de cuotas');
      } else {
        toast.error('Error al guardar la cuota');
      }
    }
  };

  const handleToggleActivo = async (tarjeta: Tarjeta) => {
    try {
      const { error } = await supabase
        .from('tarjetas')
        .update({ activo: !tarjeta.activo })
        .eq('id', tarjeta.id);
      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error toggling tarjeta:', error);
      toast.error('Error al cambiar el estado');
    }
  };

  const handleDeleteTarjeta = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta tarjeta?')) return;
    try {
      const { error } = await supabase.from('tarjetas').delete().eq('id', id);
      if (error) throw error;
      toast.success('Tarjeta eliminada');
      fetchData();
    } catch (error) {
      console.error('Error deleting tarjeta:', error);
      toast.error('Error al eliminar la tarjeta');
    }
  };

  const handleDeleteCuota = async (id: string) => {
    try {
      const { error } = await supabase.from('tarjeta_cuotas').delete().eq('id', id);
      if (error) throw error;
      toast.success('Cuota eliminada');
      fetchData();
    } catch (error) {
      console.error('Error deleting cuota:', error);
      toast.error('Error al eliminar la cuota');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const tarjetasCredito = tarjetas.filter(t => t.tipo === 'credito');
  const tarjetasDebito = tarjetas.filter(t => t.tipo === 'debito');

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader
        title="Gestión de Tarjetas"
        description="Administra las tarjetas de crédito y débito con sus coeficientes"
      />

      {isAdmin && (
        <div className="mb-6">
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Tarjeta
          </Button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Tarjetas de Crédito */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Tarjetas de Crédito
            </CardTitle>
            <CardDescription>
              Configuración de cuotas y coeficientes de interés
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {tarjetasCredito.length === 0 ? (
              <p className="text-muted-foreground text-sm">No hay tarjetas de crédito configuradas</p>
            ) : (
              tarjetasCredito.map((tarjeta) => {
                const tarjetaCuotas = cuotas.filter(c => c.tarjeta_id === tarjeta.id);
                const isExpanded = expandedCards.has(tarjeta.id);
                
                return (
                  <Collapsible key={tarjeta.id} open={isExpanded} onOpenChange={() => toggleExpand(tarjeta.id)}>
                    <div className="border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={tarjeta.activo}
                            onCheckedChange={() => handleToggleActivo(tarjeta)}
                            disabled={!isAdmin}
                          />
                          <span className={tarjeta.activo ? '' : 'text-muted-foreground line-through'}>
                            {tarjeta.nombre}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isAdmin && (
                            <>
                              <Button size="icon" variant="ghost" onClick={() => handleOpenDialog(tarjeta)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDeleteTarjeta(tarjeta.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <CollapsibleTrigger asChild>
                            <Button size="icon" variant="ghost">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                      </div>
                      
                      <CollapsibleContent>
                        <Separator className="my-3" />
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Cuotas y Coeficientes</span>
                            {isAdmin && (
                              <Button size="sm" variant="outline" onClick={() => handleOpenCuotaDialog(tarjeta.id)}>
                                <Plus className="h-3 w-3 mr-1" />
                                Agregar
                              </Button>
                            )}
                          </div>
                          {tarjetaCuotas.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Sin cuotas configuradas</p>
                          ) : (
                            <div className="grid grid-cols-3 gap-2">
                              {tarjetaCuotas.map((cuota) => (
                                <div 
                                  key={cuota.id} 
                                  className="text-xs border rounded p-2 flex items-center justify-between group"
                                >
                                  <div>
                                    <span className="font-medium">{cuota.cuotas} cuota{cuota.cuotas > 1 ? 's' : ''}</span>
                                    <div className="text-muted-foreground flex items-center gap-1">
                                      <Percent className="h-3 w-3" />
                                      {((cuota.coeficiente - 1) * 100).toFixed(1)}%
                                    </div>
                                  </div>
                                  {isAdmin && (
                                    <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className="h-6 w-6"
                                        onClick={() => handleOpenCuotaDialog(tarjeta.id, cuota)}
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                      <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className="h-6 w-6"
                                        onClick={() => handleDeleteCuota(cuota.id)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Tarjetas de Débito */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Tarjetas de Débito
            </CardTitle>
            <CardDescription>
              Configuración de tarjetas de débito y coeficientes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {tarjetasDebito.length === 0 ? (
              <p className="text-muted-foreground text-sm">No hay tarjetas de débito configuradas</p>
            ) : (
              tarjetasDebito.map((tarjeta) => {
                const tarjetaCuotas = cuotas.filter(c => c.tarjeta_id === tarjeta.id);
                const isExpanded = expandedCards.has(tarjeta.id);
                
                return (
                  <Collapsible key={tarjeta.id} open={isExpanded} onOpenChange={() => toggleExpand(tarjeta.id)}>
                    <div className="border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={tarjeta.activo}
                            onCheckedChange={() => handleToggleActivo(tarjeta)}
                            disabled={!isAdmin}
                          />
                          <span className={tarjeta.activo ? '' : 'text-muted-foreground line-through'}>
                            {tarjeta.nombre}
                          </span>
                          <Badge variant="secondary">Débito</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {isAdmin && (
                            <>
                              <Button size="icon" variant="ghost" onClick={() => handleOpenDialog(tarjeta)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDeleteTarjeta(tarjeta.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <CollapsibleTrigger asChild>
                            <Button size="icon" variant="ghost">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                      </div>
                      
                      <CollapsibleContent>
                        <Separator className="my-3" />
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Coeficiente de Interés</span>
                            {isAdmin && tarjetaCuotas.length === 0 && (
                              <Button size="sm" variant="outline" onClick={() => handleOpenCuotaDialog(tarjeta.id)}>
                                <Plus className="h-3 w-3 mr-1" />
                                Agregar
                              </Button>
                            )}
                          </div>
                          {tarjetaCuotas.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Sin coeficiente configurado (1.00 por defecto)</p>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              {tarjetaCuotas.map((cuota) => (
                                <div 
                                  key={cuota.id} 
                                  className="text-xs border rounded p-2 flex items-center justify-between group"
                                >
                                  <div>
                                    <span className="font-medium">Coeficiente</span>
                                    <div className="text-muted-foreground flex items-center gap-1">
                                      <Percent className="h-3 w-3" />
                                      {((cuota.coeficiente - 1) * 100).toFixed(1)}%
                                    </div>
                                  </div>
                                  {isAdmin && (
                                    <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className="h-6 w-6"
                                        onClick={() => handleOpenCuotaDialog(tarjeta.id, cuota)}
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                      <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className="h-6 w-6"
                                        onClick={() => handleDeleteCuota(cuota.id)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog para Tarjeta */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTarjeta ? 'Editar Tarjeta' : 'Nueva Tarjeta'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                placeholder="Ej: Visa Crédito"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value: 'credito' | 'debito') => setFormData({ ...formData, tipo: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credito">Crédito</SelectItem>
                  <SelectItem value="debito">Débito</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveTarjeta}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para Cuota */}
      <Dialog open={cuotaDialogOpen} onOpenChange={setCuotaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCuota ? 'Editar Cuota' : 'Nueva Cuota'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cuotas">Cantidad de Cuotas</Label>
              <Input
                id="cuotas"
                type="number"
                min={1}
                value={cuotaFormData.cuotas}
                onChange={(e) => setCuotaFormData({ ...cuotaFormData, cuotas: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interes">Interés (%)</Label>
              <Input
                id="interes"
                type="number"
                step="0.1"
                min={0}
                value={cuotaFormData.interes}
                onChange={(e) => setCuotaFormData({ ...cuotaFormData, interes: parseFloat(e.target.value) || 0 })}
                placeholder="Ej: 5 para 5%"
              />
              <p className="text-xs text-muted-foreground">
                Coeficiente: {(1 + cuotaFormData.interes / 100).toFixed(4)}
                {cuotaFormData.interes > 0 && ` (Ej: $1000 → $${(1000 * (1 + cuotaFormData.interes / 100)).toFixed(0)})`}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCuotaDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveCuota}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
