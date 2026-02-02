import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Plus, Package, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ProductoFoco } from '@/hooks/useVisitas';

interface ProductosFocoTabProps {
  productosFoco: ProductoFoco[];
  mes: number;
  anio: number;
}

export function ProductosFocoTab({ productosFoco, mes, anio }: ProductosFocoTabProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchProducto, setSearchProducto] = useState('');
  const [selectedProducto, setSelectedProducto] = useState<{ id: string; descripcion: string } | null>(null);
  const [metaUnidades, setMetaUnidades] = useState('');
  const [metaMonto, setMetaMonto] = useState('');
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: productos = [] } = useQuery({
    queryKey: ['productos-busqueda', searchProducto],
    queryFn: async () => {
      if (searchProducto.length < 2) return [];
      const { data, error } = await supabase
        .from('productos')
        .select('id, descripcion, codigo_articulo')
        .eq('activo', true)
        .or(`descripcion.ilike.%${searchProducto}%,codigo_articulo.ilike.%${searchProducto}%`)
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: searchProducto.length >= 2,
  });

  const crearProductoFoco = useMutation({
    mutationFn: async () => {
      if (!selectedProducto) throw new Error('Seleccione un producto');
      const { error } = await supabase.from('productos_foco').insert({
        producto_id: selectedProducto.id,
        periodo_mes: mes,
        periodo_anio: anio,
        meta_unidades: parseInt(metaUnidades) || 0,
        meta_monto: parseFloat(metaMonto) || 0,
        activo: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos_foco'] });
      toast({ title: 'Producto foco agregado' });
      setSheetOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setSearchProducto('');
    setSelectedProducto(null);
    setMetaUnidades('');
    setMetaMonto('');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          Productos Foco - {mes}/{anio}
        </h3>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Agregar Producto
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Agregar Producto Foco</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Buscar Producto</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Código o descripción..."
                    value={searchProducto}
                    onChange={(e) => {
                      setSearchProducto(e.target.value);
                      setSelectedProducto(null);
                    }}
                  />
                </div>
                {productos.length > 0 && !selectedProducto && (
                  <div className="mt-2 border rounded-md max-h-40 overflow-y-auto">
                    {productos.map((p) => (
                      <button
                        key={p.id}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted border-b last:border-b-0"
                        onClick={() => {
                          setSelectedProducto({ id: p.id, descripcion: p.descripcion });
                          setSearchProducto(p.descripcion);
                        }}
                      >
                        <span className="font-medium">{p.codigo_articulo}</span> - {p.descripcion}
                      </button>
                    ))}
                  </div>
                )}
                {selectedProducto && (
                  <Badge className="mt-2" variant="secondary">
                    {selectedProducto.descripcion}
                  </Badge>
                )}
              </div>
              <div>
                <Label>Meta en Unidades</Label>
                <Input
                  type="number"
                  value={metaUnidades}
                  onChange={(e) => setMetaUnidades(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Meta en Monto ($)</Label>
                <Input
                  type="number"
                  value={metaMonto}
                  onChange={(e) => setMetaMonto(e.target.value)}
                  placeholder="0"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => crearProductoFoco.mutate()}
                disabled={!selectedProducto || crearProductoFoco.isPending}
              >
                Agregar Producto Foco
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {productosFoco.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay productos foco definidos para este período</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {productosFoco.map((pf) => {
            const unidadesProgress = pf.meta_unidades > 0 ? (pf.unidades_vendidas / pf.meta_unidades) * 100 : 0;
            const montoProgress = pf.meta_monto > 0 ? (pf.monto_vendido / pf.meta_monto) * 100 : 0;

            return (
              <Card key={pf.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium line-clamp-2">
                    {pf.producto?.descripcion || 'Producto'}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{pf.producto?.codigo_articulo}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Unidades</span>
                      <span className="font-medium">
                        {pf.unidades_vendidas} / {pf.meta_unidades}
                      </span>
                    </div>
                    <Progress value={Math.min(unidadesProgress, 100)} className="h-2" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Monto</span>
                      <span className="font-medium">
                        {formatCurrency(pf.monto_vendido)} / {formatCurrency(pf.meta_monto)}
                      </span>
                    </div>
                    <Progress value={Math.min(montoProgress, 100)} className="h-2" />
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
