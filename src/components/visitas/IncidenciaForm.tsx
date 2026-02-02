import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle } from 'lucide-react';
import { useVisitaMutations, VisitaIncidencia } from '@/hooks/useVisitas';

interface IncidenciaFormProps {
  visitaId: string;
}

const tiposIncidencia = [
  { value: 'reclamo', label: 'Reclamo' },
  { value: 'devolucion', label: 'Devolución' },
  { value: 'competencia', label: 'Competencia' },
  { value: 'exhibicion', label: 'Exhibición' },
  { value: 'stock', label: 'Stock' },
  { value: 'otro', label: 'Otro' },
];

const prioridades = [
  { value: 'baja', label: 'Baja' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

export function IncidenciaForm({ visitaId }: IncidenciaFormProps) {
  const [tipo, setTipo] = useState<VisitaIncidencia['tipo']>('otro');
  const [descripcion, setDescripcion] = useState('');
  const [prioridad, setPrioridad] = useState<VisitaIncidencia['prioridad']>('media');
  const { agregarIncidencia } = useVisitaMutations();

  const handleSubmit = () => {
    if (!descripcion.trim()) return;
    agregarIncidencia.mutate({
      visita_id: visitaId,
      tipo,
      descripcion,
      prioridad,
      estado: 'abierta',
    }, {
      onSuccess: () => {
        setDescripcion('');
        setTipo('otro');
        setPrioridad('media');
      },
    });
  };

  return (
    <div className="space-y-4">
      <h4 className="font-medium flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        Registrar Incidencia
      </h4>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Tipo</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as VisitaIncidencia['tipo'])}
          >
            {tiposIncidencia.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Prioridad</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={prioridad}
            onChange={(e) => setPrioridad(e.target.value as VisitaIncidencia['prioridad'])}
          >
            {prioridades.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Label>Descripción</Label>
        <Textarea
          placeholder="Detalle de la incidencia..."
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={2}
        />
      </div>

      <Button 
        variant="outline"
        onClick={handleSubmit}
        disabled={!descripcion.trim() || agregarIncidencia.isPending}
        className="w-full"
      >
        <AlertTriangle className="h-4 w-4 mr-2" />
        Registrar Incidencia
      </Button>
    </div>
  );
}
