import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpleadoActual, useMisHojasRuta } from '@/hooks/useEncargado';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut, RefreshCw, Truck, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';

const estadoColor = (e: string) => {
  if (e === 'en_carga') return 'bg-amber-500/10 text-amber-700 border-amber-500/30';
  if (e === 'carga_confirmada') return 'bg-blue-500/10 text-blue-700 border-blue-500/30';
  if (e === 'en_ruta') return 'bg-green-500/10 text-green-700 border-green-500/30';
  if (e === 'completada') return 'bg-gray-500/10 text-gray-700 border-gray-500/30';
  return 'bg-muted text-muted-foreground';
};

export default function Encargado() {
  const { user, loading, signOut } = useAuth();
  const qc = useQueryClient();
  const { data: empleado, isLoading: loadingEmp } = useEmpleadoActual();
  const { data: hojas = [], isLoading: loadingHojas, refetch } = useMisHojasRuta();

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!user) return <Navigate to="/auth?redirect=/encargado" replace />;

  if (!loadingEmp && !empleado) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <Truck className="h-12 w-12 text-muted-foreground mb-3" />
        <h1 className="text-lg font-semibold mb-1">Sin empleado vinculado</h1>
        <p className="text-sm text-muted-foreground mb-4">Tu usuario no está asociado a un empleado del sistema.</p>
        <Button variant="outline" onClick={signOut}><LogOut className="h-4 w-4 mr-2" />Cerrar sesión</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="max-w-md mx-auto p-3 flex items-center justify-between">
          <div>
            <h1 className="font-semibold leading-tight">Mi Reparto</h1>
            <p className="text-xs text-muted-foreground">{empleado?.nombre}</p>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => { qc.invalidateQueries(); refetch(); }}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-3 space-y-2">
        {loadingHojas ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : hojas.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Truck className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Sin hojas de ruta asignadas</p>
          </div>
        ) : (
          hojas.map((h: any) => {
            const totalParadas = h.paradas?.length ?? 0;
            const completadas = h.paradas?.filter((p: any) => p.estado !== 'pendiente').length ?? 0;
            return (
              <Link key={h.id} to={`/encargado/${h.id}`}>
                <Card className="active:scale-[0.99] transition">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold">HR #{h.numero_hoja}</span>
                        <Badge variant="outline" className={`text-xs capitalize ${estadoColor(h.estado)}`}>
                          {h.estado.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(h.fecha), "EEE d 'de' MMMM", { locale: es })}
                        {h.vehiculo?.patente && <> · {h.vehiculo.patente}</>}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {completadas}/{totalParadas} paradas
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            );
          })
        )}
      </main>
    </div>
  );
}