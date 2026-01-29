import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Lightbulb, MessageSquare, CheckCircle, Clock, XCircle, Loader2 } from 'lucide-react';

interface Sugerencia {
  id: string;
  usuario_id: string;
  contenido: string;
  estado: string;
  respuesta: string | null;
  respondido_por: string | null;
  fecha_respuesta: string | null;
  created_at: string;
  usuario_nombre?: string;
  usuario_email?: string;
}

export default function Sugerencias() {
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSugerencia, setSelectedSugerencia] = useState<Sugerencia | null>(null);
  const [respuesta, setRespuesta] = useState('');
  const [respondiendo, setRespondiendo] = useState(false);
  const { hasRole } = useAuth();
  
  const isAdmin = hasRole('admin');

  useEffect(() => {
    fetchSugerencias();
  }, []);

  const fetchSugerencias = async () => {
    try {
      // Fetch sugerencias
      const { data: sugerenciasData, error: sugerenciasError } = await supabase
        .from('sugerencias')
        .select('*')
        .order('created_at', { ascending: false });

      if (sugerenciasError) throw sugerenciasError;

      // Fetch profiles for each sugerencia
      const userIds = [...new Set((sugerenciasData || []).map(s => s.usuario_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, nombre, email')
        .in('id', userIds);

      const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));

      const enrichedSugerencias = (sugerenciasData || []).map(s => ({
        ...s,
        usuario_nombre: profilesMap.get(s.usuario_id)?.nombre || 'Usuario',
        usuario_email: profilesMap.get(s.usuario_id)?.email || ''
      }));

      setSugerencias(enrichedSugerencias);
    } catch (error) {
      console.error('Error fetching sugerencias:', error);
      toast.error('Error al cargar las sugerencias');
    } finally {
      setLoading(false);
    }
  };

  const handleResponder = async () => {
    if (!selectedSugerencia || !respuesta.trim()) return;

    setRespondiendo(true);
    try {
      const { error } = await supabase
        .from('sugerencias')
        .update({
          estado: 'respondida',
          respuesta: respuesta.trim(),
          respondido_por: (await supabase.auth.getUser()).data.user?.id,
          fecha_respuesta: new Date().toISOString()
        })
        .eq('id', selectedSugerencia.id);

      if (error) throw error;

      toast.success('Respuesta enviada');
      setSelectedSugerencia(null);
      setRespuesta('');
      fetchSugerencias();
    } catch (error) {
      console.error('Error respondiendo:', error);
      toast.error('Error al enviar la respuesta');
    } finally {
      setRespondiendo(false);
    }
  };

  const cambiarEstado = async (id: string, nuevoEstado: string) => {
    try {
      const { error } = await supabase
        .from('sugerencias')
        .update({ estado: nuevoEstado })
        .eq('id', id);

      if (error) throw error;

      toast.success('Estado actualizado');
      fetchSugerencias();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al actualizar el estado');
    }
  };

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'pendiente':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pendiente</Badge>;
      case 'en_revision':
        return <Badge variant="outline" className="gap-1"><MessageSquare className="h-3 w-3" /> En revisión</Badge>;
      case 'respondida':
        return <Badge className="gap-1 bg-green-600 hover:bg-green-700"><CheckCircle className="h-3 w-3" /> Respondida</Badge>;
      case 'rechazada':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Rechazada</Badge>;
      default:
        return <Badge variant="secondary">{estado}</Badge>;
    }
  };

  const stats = {
    total: sugerencias.length,
    pendientes: sugerencias.filter(s => s.estado === 'pendiente').length,
    enRevision: sugerencias.filter(s => s.estado === 'en_revision').length,
    respondidas: sugerencias.filter(s => s.estado === 'respondida').length,
  };

  return (
    <MainLayout>
      <PageHeader
        title="Sugerencias"
        description="Visualiza y gestiona las sugerencias de los usuarios"
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pendientes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Revisión</CardTitle>
            <MessageSquare className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.enRevision}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Respondidas</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.respondidas}</div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de sugerencias */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : sugerencias.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No hay sugerencias</h3>
            <p className="text-muted-foreground">Las sugerencias de los usuarios aparecerán aquí</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sugerencias.map((sugerencia) => (
            <Card key={sugerencia.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      {getEstadoBadge(sugerencia.estado)}
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(sugerencia.created_at), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                      </span>
                    </div>
                    
                    <p className="font-medium">
                      {sugerencia.profiles?.nombre || 'Usuario'}
                      <span className="text-sm text-muted-foreground ml-2">
                        ({sugerencia.profiles?.email})
                      </span>
                    </p>
                    
                    <p className="text-sm bg-muted p-3 rounded-lg">{sugerencia.contenido}</p>
                    
                    {sugerencia.respuesta && (
                      <div className="mt-3 pl-4 border-l-2 border-primary">
                        <p className="text-sm font-medium text-primary mb-1">Respuesta:</p>
                        <p className="text-sm">{sugerencia.respuesta}</p>
                        {sugerencia.fecha_respuesta && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(sugerencia.fecha_respuesta), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {isAdmin && sugerencia.estado !== 'respondida' && (
                    <div className="flex flex-col gap-2">
                      {sugerencia.estado === 'pendiente' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cambiarEstado(sugerencia.id, 'en_revision')}
                        >
                          Marcar en revisión
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedSugerencia(sugerencia);
                          setRespuesta('');
                        }}
                      >
                        Responder
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog para responder */}
      <Dialog open={!!selectedSugerencia} onOpenChange={() => setSelectedSugerencia(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Responder Sugerencia</DialogTitle>
          </DialogHeader>
          
          {selectedSugerencia && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1">Sugerencia de {selectedSugerencia.profiles?.nombre}:</p>
                <p className="text-sm bg-muted p-3 rounded-lg">{selectedSugerencia.contenido}</p>
              </div>
              
              <Textarea
                value={respuesta}
                onChange={(e) => setRespuesta(e.target.value)}
                placeholder="Escribe tu respuesta..."
                className="min-h-[100px]"
              />
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedSugerencia(null)}>
              Cancelar
            </Button>
            <Button onClick={handleResponder} disabled={respondiendo || !respuesta.trim()}>
              {respondiendo ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Enviar Respuesta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
