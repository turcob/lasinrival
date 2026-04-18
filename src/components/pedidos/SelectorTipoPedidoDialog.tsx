import { Globe, Truck, Layers } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTipoPedido, type TipoPedidoFiltro } from '@/contexts/TipoPedidoContext';

export function SelectorTipoPedidoDialog() {
  const { modalAbierto, setModalAbierto, setTipo } = useTipoPedido();

  const handleSelect = (t: TipoPedidoFiltro) => {
    setTipo(t);
    setModalAbierto(false);
  };

  return (
    <Dialog open={modalAbierto} onOpenChange={setModalAbierto}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>¿Qué deseas gestionar?</DialogTitle>
          <DialogDescription>
            Elegí el tipo de pedidos que querés ver. Podés cambiarlo después desde el selector superior.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 mt-2">
          <Button
            variant="outline"
            className="h-auto py-4 justify-start border-red-300 hover:bg-red-50 hover:border-red-400"
            onClick={() => handleSelect('web')}
          >
            <Globe className="h-6 w-6 mr-3 text-red-600" />
            <div className="text-left">
              <div className="font-semibold text-red-700">Pedidos Web</div>
              <div className="text-xs text-muted-foreground">Pedidos generados desde la web (Paladini)</div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 justify-start border-blue-300 hover:bg-blue-50 hover:border-blue-400"
            onClick={() => handleSelect('reparto')}
          >
            <Truck className="h-6 w-6 mr-3 text-blue-600" />
            <div className="text-left">
              <div className="font-semibold text-blue-700">Pedidos de Reparto</div>
              <div className="text-xs text-muted-foreground">Pedidos cargados por vendedores para distribución</div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 justify-start"
            onClick={() => handleSelect('ambos')}
          >
            <Layers className="h-6 w-6 mr-3 text-muted-foreground" />
            <div className="text-left">
              <div className="font-semibold">Ambos</div>
              <div className="text-xs text-muted-foreground">Ver todos los pedidos sin filtrar</div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
