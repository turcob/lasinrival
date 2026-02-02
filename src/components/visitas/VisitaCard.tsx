import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { MapPin, Phone, Clock, CheckCircle, XCircle, AlertTriangle, MessageSquare } from 'lucide-react';
import { Visita, useVisitaMutations, useVisitaIncidencias } from '@/hooks/useVisitas';
import { IncidenciaForm } from './IncidenciaForm';

interface VisitaCardProps {
  visita: Visita;
}

const estadoBadge: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  pendiente: { variant: 'secondary', label: 'Pendiente' },
  en_curso: { variant: 'default', label: 'En curso' },
  completada: { variant: 'default', label: 'Completada' },
  cancelada: { variant: 'outline', label: 'Cancelada' },
  no_visitado: { variant: 'destructive', label: 'No visitado' },
};

export function VisitaCard({ visita }: VisitaCardProps) {
  const [notas, setNotas] = useState('');
  const [motivoNoVisita, setMotivoNoVisita] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const { hacerCheckin, marcarNoVisitado } = useVisitaMutations();
  const { data: incidencias = [] } = useVisitaIncidencias(visita.id);

  const handleCheckin = () => {
    hacerCheckin.mutate({ visitaId: visita.id, notas }, {
      onSuccess: () => setSheetOpen(false),
    });
  };

  const handleNoVisitado = () => {
    if (!motivoNoVisita.trim()) return;
    marcarNoVisitado.mutate({ visitaId: visita.id, motivo: motivoNoVisita }, {
      onSuccess: () => setSheetOpen(false),
    });
  };

  const badgeInfo = estadoBadge[visita.estado] || estadoBadge.pendiente;

  return (
    <Card className={visita.estado === 'completada' ? 'border-green-200 bg-green-50/50' : visita.estado === 'no_visitado' ? 'border-red-200 bg-red-50/50' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base font-semibold line-clamp-1">
            {visita.cliente?.nombre || 'Cliente'}
          </CardTitle>
          <Badge variant={badgeInfo.variant}>{badgeInfo.label}</Badge>
        </div>
        {visita.vendedor && (
          <p className="text-sm text-muted-foreground">
            Vendedor: {visita.vendedor.nombre}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {visita.cliente?.direccion && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <span className="text-muted-foreground line-clamp-2">{visita.cliente.direccion}</span>
          </div>
        )}
        {visita.cliente?.telefono && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <a href={`tel:${visita.cliente.telefono}`} className="text-primary hover:underline">
              {visita.cliente.telefono}
            </a>
          </div>
        )}
        {visita.hora_programada && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{visita.hora_programada.slice(0, 5)}</span>
          </div>
        )}

        {visita.estado === 'completada' && visita.fecha_checkin && (
          <div className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle className="h-4 w-4" />
            <span>Check-in: {new Date(visita.fecha_checkin).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )}

        {visita.estado === 'no_visitado' && visita.motivo_no_visita && (
          <div className="text-sm text-red-700 bg-red-100 rounded p-2">
            <strong>Motivo:</strong> {visita.motivo_no_visita}
          </div>
        )}

        {incidencias.length > 0 && (
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span className="text-sm text-yellow-700">{incidencias.length} incidencia(s)</span>
          </div>
        )}

        {visita.notas && (
          <div className="text-sm bg-muted rounded p-2">
            <MessageSquare className="h-3 w-3 inline mr-1" />
            {visita.notas}
          </div>
        )}

        {visita.estado === 'pendiente' && (
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button className="w-full" size="sm">
                <MapPin className="h-4 w-4 mr-2" />
                Registrar Visita
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Registrar Visita - {visita.cliente?.nombre}</SheetTitle>
              </SheetHeader>
              <div className="space-y-6 py-4">
                {/* Check-in */}
                <div className="space-y-3">
                  <h4 className="font-medium">Check-in con GPS</h4>
                  <div>
                    <Label>Notas de la visita</Label>
                    <Textarea
                      placeholder="Observaciones, comentarios del cliente, etc."
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <Button 
                    onClick={handleCheckin} 
                    disabled={hacerCheckin.isPending}
                    className="w-full"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirmar Visita
                  </Button>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">¿No se pudo visitar?</h4>
                  <div className="space-y-3">
                    <div>
                      <Label>Motivo</Label>
                      <Textarea
                        placeholder="Ej: Local cerrado, cliente ausente, etc."
                        value={motivoNoVisita}
                        onChange={(e) => setMotivoNoVisita(e.target.value)}
                        rows={2}
                      />
                    </div>
                    <Button 
                      variant="destructive"
                      onClick={handleNoVisitado}
                      disabled={!motivoNoVisita.trim() || marcarNoVisitado.isPending}
                      className="w-full"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Marcar como No Visitado
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <IncidenciaForm visitaId={visita.id} />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </CardContent>
    </Card>
  );
}
