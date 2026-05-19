import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useHojaRuta, useCambiarEstadoHojaRuta, useRendicionHojaRuta } from '@/hooks/useLogistica';
import { useEmpleadoActual } from '@/hooks/useEncargado';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, Loader2, Truck, PlayCircle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CargaTab } from '@/components/encargado/CargaTab';
import { ParadasTab } from '@/components/encargado/ParadasTab';
import { ResumenCobrosTab } from '@/components/encargado/ResumenCobrosTab';
import { RendicionTab } from '@/components/encargado/RendicionTab';

const estadoColor = (e: string) => {
  if (e === 'en_carga') return 'bg-amber-500/10 text-amber-700 border-amber-500/30';
  if (e === 'carga_confirmada') return 'bg-blue-500/10 text-blue-700 border-blue-500/30';
  if (e === 'en_ruta') return 'bg-green-500/10 text-green-700 border-green-500/30';
  if (e === 'completada') return 'bg-gray-500/10 text-gray-700 border-gray-500/30';
  if (e === 'rendida') return 'bg-purple-500/10 text-purple-700 border-purple-500/30';
  return 'bg-muted text-muted-foreground';
};

const estadoLabel: Record<string, string> = {
  en_carga: 'En carga',
  carga_confirmada: 'Carga confirmada',
  en_ruta: 'En ruta',
  completada: 'Completada',
  rendida: 'Rendida',
  cancelada: 'Cancelada',
};

export default function EncargadoHojaDetalle() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: loadingAuth } = useAuth();
  const { data: empleado, isLoading: loadingEmp } = useEmpleadoActual();
  const { data: hoja, isLoading } = useHojaRuta(id);
  const cambiarEstado = useCambiarEstadoHojaRuta();
  const { data: rendicion } = useRendicionHojaRuta(id);

  if (loadingAuth) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!user) return <Navigate to={`/auth?redirect=/encargado/${id}`} replace />;

  if (isLoading || loadingEmp || !hoja) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  // Validar permiso: el usuario debe ser responsable o chofer de esta hoja
  const esDuenio = empleado?.id && (hoja.responsable_id === empleado.id || hoja.chofer_id === empleado.id);
  if (!esDuenio) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <Truck className="h-12 w-12 text-muted-foreground mb-3" />
        <h1 className="text-lg font-semibold mb-1">Sin acceso</h1>
        <p className="text-sm text-muted-foreground mb-4">No estás asignado a esta hoja de ruta.</p>
        <Button asChild variant="outline"><Link to="/encargado"><ArrowLeft className="h-4 w-4 mr-2" />Volver</Link></Button>
      </div>
    );
  }

  const estado = hoja.estado as string;
  const paradas = (hoja as any).paradas ?? [];

  // Tabs dinámicas por estado
  const tabs: { value: string; label: string }[] = [];
  if (estado === 'en_carga') tabs.push({ value: 'carga', label: 'Carga' });
  if (estado === 'carga_confirmada') tabs.push({ value: 'salir', label: 'Salir a ruta' });
  if (estado === 'en_ruta') {
    tabs.push({ value: 'paradas', label: 'Paradas' });
    tabs.push({ value: 'resumen', label: 'Cobros' });
    tabs.push({ value: 'cerrar', label: 'Cerrar' });
  }
  if (estado === 'completada' || estado === 'rendida') {
    tabs.push({ value: 'rendicion', label: 'Rendición' });
    tabs.push({ value: 'resumen', label: 'Cobros' });
  }
  if (tabs.length === 0) tabs.push({ value: 'info', label: 'Info' });

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="max-w-md mx-auto p-3 flex items-center gap-2">
          <Button asChild variant="ghost" size="icon">
            <Link to="/encargado"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold leading-tight">Hoja #{hoja.numero_hoja}</h1>
            <p className="text-xs text-muted-foreground truncate">
              {format(new Date(hoja.fecha + 'T00:00:00'), "EEE d 'de' MMM", { locale: es })}
              {hoja.vehiculo?.patente ? ` · ${hoja.vehiculo.patente}` : ''}
            </p>
          </div>
          <Badge variant="outline" className={estadoColor(estado)}>{estadoLabel[estado] ?? estado}</Badge>
        </div>
      </header>

      <main className="max-w-md mx-auto p-3 space-y-3">
        <Tabs defaultValue={tabs[0].value} className="w-full">
          <TabsList className="w-full" style={{ display: 'grid', gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
            {tabs.map(t => (
              <TabsTrigger key={t.value} value={t.value} className="text-xs">{t.label}</TabsTrigger>
            ))}
          </TabsList>

          {estado === 'en_carga' && (
            <TabsContent value="carga" className="mt-3">
              <CargaTab hojaRutaId={hoja.id} />
            </TabsContent>
          )}

          {estado === 'carga_confirmada' && (
            <TabsContent value="salir" className="mt-3">
              <Card>
                <CardContent className="p-4 space-y-3 text-center">
                  <PlayCircle className="h-12 w-12 mx-auto text-primary" />
                  <p className="text-sm">La carga fue confirmada. Cuando salgas con el vehículo, marcá la hoja como en ruta.</p>
                  <Button
                    className="w-full"
                    size="lg"
                    disabled={cambiarEstado.isPending}
                    onClick={() => cambiarEstado.mutate({ id: hoja.id, estado: 'en_ruta' })}
                  >
                    {cambiarEstado.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Truck className="h-4 w-4 mr-2" />}
                    Salir a ruta
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {estado === 'en_ruta' && (
            <>
              <TabsContent value="paradas" className="mt-3">
                <ParadasTab hojaRutaId={hoja.id} paradas={paradas} />
              </TabsContent>
              <TabsContent value="resumen" className="mt-3">
                <ResumenCobrosTab hojaRutaId={hoja.id} />
              </TabsContent>
              <TabsContent value="cerrar" className="mt-3">
                <Card>
                  <CardContent className="p-4 space-y-3 text-center">
                    <CheckCircle2 className="h-12 w-12 mx-auto text-primary" />
                    <p className="text-sm">
                      Cuando termines todas las entregas, cerrá la ruta para poder rendir lo cobrado.
                    </p>
                    {(() => {
                      const pend = paradas.filter((p: any) => p.estado === 'pendiente').length;
                      return pend > 0 ? (
                        <p className="text-xs text-amber-700">
                          Quedan {pend} parada{pend !== 1 ? 's' : ''} pendiente{pend !== 1 ? 's' : ''}.
                        </p>
                      ) : null;
                    })()}
                    <Button
                      className="w-full"
                      size="lg"
                      disabled={cambiarEstado.isPending}
                      onClick={() => cambiarEstado.mutate({ id: hoja.id, estado: 'completada' })}
                    >
                      {cambiarEstado.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      Cerrar ruta y rendir
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </>
          )}

          {(estado === 'completada' || estado === 'rendida') && (
            <>
              <TabsContent value="rendicion" className="mt-3">
                {rendicion && estado === 'rendida' ? (
                  <Card>
                    <CardContent className="p-4 text-sm space-y-1">
                      <p className="font-semibold">Rendición aprobada</p>
                      <p className="text-muted-foreground text-xs">Esta hoja ya fue rendida y aprobada.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <RendicionTab hojaRutaId={hoja.id} numeroHoja={hoja.numero_hoja} />
                )}
              </TabsContent>
              <TabsContent value="resumen" className="mt-3">
                <ResumenCobrosTab hojaRutaId={hoja.id} />
              </TabsContent>
            </>
          )}

          {tabs[0].value === 'info' && (
            <TabsContent value="info" className="mt-3">
              <Card>
                <CardContent className="p-4 text-sm text-muted-foreground">
                  Estado actual: <strong>{estadoLabel[estado] ?? estado}</strong>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}