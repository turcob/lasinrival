import { Globe, Truck, Layers, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTipoPedido } from '@/contexts/TipoPedidoContext';

export function TipoPedidoSelector() {
  const { tipo, setTipo, setModalAbierto } = useTipoPedido();

  return (
    <div className="flex items-center gap-2">
      <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="web">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-red-600" />
              <span>Web</span>
            </div>
          </SelectItem>
          <SelectItem value="reparto">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-blue-600" />
              <span>Reparto</span>
            </div>
          </SelectItem>
          <SelectItem value="ambos">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              <span>Ambos</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
      {tipo === 'web' && (
        <Badge className="bg-red-600 hover:bg-red-700 text-white border-0">
          <Globe className="h-3 w-3 mr-1" /> Modo Web
        </Badge>
      )}
      {tipo === 'reparto' && (
        <Badge className="bg-blue-600 hover:bg-blue-700 text-white border-0">
          <Truck className="h-3 w-3 mr-1" /> Modo Reparto
        </Badge>
      )}
      <Button variant="ghost" size="icon" onClick={() => setModalAbierto(true)} title="Cambiar selección">
        <RefreshCw className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function TipoPedidoBadge({ tipo }: { tipo: string | null | undefined }) {
  if (tipo === 'web') {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-300 hover:bg-red-100">
        <Globe className="h-3 w-3 mr-1" /> Web
      </Badge>
    );
  }
  return (
    <Badge className="bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-100">
      <Truck className="h-3 w-3 mr-1" /> Reparto
    </Badge>
  );
}
