import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Barcode, Check, Search, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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

interface ProductoMin {
  id: string;
  codigo_articulo: string;
  descripcion: string;
  codigo_barra: string | null;
}

interface CargaCodigosBarraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productos: ProductoMin[];
  onUpdated?: () => void;
}

interface HistorialItem {
  id: string;
  codigo_articulo: string;
  descripcion: string;
  codigo_barra: string;
  at: number;
}

export function CargaCodigosBarraDialog({
  open,
  onOpenChange,
  productos,
  onUpdated,
}: CargaCodigosBarraDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<ProductoMin | null>(null);
  const [codigoBarra, setCodigoBarra] = useState('');
  const [saving, setSaving] = useState(false);
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [confirmState, setConfirmState] = useState<
    | null
    | {
        tipo: 'sobrescribir' | 'duplicado';
        mensaje: string;
        onConfirm: () => void;
      }
  >(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  // Foco inicial en el buscador
  useEffect(() => {
    if (open) {
      setSearchTerm('');
      setSelected(null);
      setCodigoBarra('');
      setHistorial([]);
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  // Al seleccionar producto, foco al input de código de barras
  useEffect(() => {
    if (selected) {
      setCodigoBarra(selected.codigo_barra ?? '');
      setTimeout(() => {
        barcodeRef.current?.focus();
        barcodeRef.current?.select();
      }, 50);
    }
  }, [selected]);

  const resultados = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [] as ProductoMin[];
    return productos
      .filter(
        (p) =>
          p.codigo_articulo.toLowerCase().includes(term) ||
          p.descripcion.toLowerCase().includes(term),
      )
      .slice(0, 20);
  }, [productos, searchTerm]);

  const persistir = async (producto: ProductoMin, codigo: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('productos')
        .update({ codigo_barra: codigo })
        .eq('id', producto.id);
      if (error) throw error;

      setHistorial((h) => [
        {
          id: producto.id,
          codigo_articulo: producto.codigo_articulo,
          descripcion: producto.descripcion,
          codigo_barra: codigo,
          at: Date.now(),
        },
        ...h,
      ].slice(0, 30));

      // Reset y volver al buscador
      setSelected(null);
      setCodigoBarra('');
      setSearchTerm('');
      setTimeout(() => searchRef.current?.focus(), 50);
      onUpdated?.();
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err.message || 'Error al guardar código de barras');
    } finally {
      setSaving(false);
    }
  };

  const handleGuardar = async () => {
    if (!selected) return;
    const codigo = codigoBarra.trim();
    if (!codigo) {
      toast.error('Ingresá un código de barras');
      return;
    }

    // Duplicado en otro producto
    const { data: existing } = await supabase
      .from('productos')
      .select('id, descripcion, codigo_articulo')
      .eq('codigo_barra', codigo)
      .neq('id', selected.id)
      .limit(1)
      .maybeSingle();

    if (existing) {
      setConfirmState({
        tipo: 'duplicado',
        mensaje: `El código ${codigo} ya está asignado a ${existing.codigo_articulo} - ${existing.descripcion}. ¿Reasignarlo al producto seleccionado?`,
        onConfirm: async () => {
          setConfirmState(null);
          // Liberar del anterior y asignar al actual
          await supabase
            .from('productos')
            .update({ codigo_barra: null })
            .eq('id', existing.id);
          await persistir(selected, codigo);
        },
      });
      return;
    }

    // Sobrescribir código previo del mismo producto
    if (selected.codigo_barra && selected.codigo_barra !== codigo) {
      setConfirmState({
        tipo: 'sobrescribir',
        mensaje: `Este producto ya tiene el código ${selected.codigo_barra}. ¿Reemplazarlo por ${codigo}?`,
        onConfirm: () => {
          setConfirmState(null);
          persistir(selected, codigo);
        },
      });
      return;
    }

    await persistir(selected, codigo);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && resultados.length > 0) {
      e.preventDefault();
      setSelected(resultados[0]);
    } else if (e.key === 'Escape') {
      setSearchTerm('');
    }
  };

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleGuardar();
    } else if (e.key === 'Escape') {
      setSelected(null);
      setCodigoBarra('');
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Barcode className="h-5 w-5" />
              Carga rápida de códigos de barra
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col p-6 gap-4">
            {!selected ? (
              <>
                <div>
                  <Label htmlFor="buscar-producto">1. Buscar producto</Label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="buscar-producto"
                      ref={searchRef}
                      className="pl-10"
                      placeholder="Código de artículo o descripción... (Enter para seleccionar el primer resultado)"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                    />
                  </div>
                </div>

                <ScrollArea className="flex-1 border rounded-md">
                  {resultados.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      {searchTerm
                        ? 'Sin resultados'
                        : 'Empezá a escribir para buscar un producto'}
                    </div>
                  ) : (
                    <ul className="divide-y">
                      {resultados.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => setSelected(p)}
                            className="w-full text-left p-3 hover:bg-accent focus:bg-accent focus:outline-none flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-mono text-muted-foreground">
                                {p.codigo_articulo}
                              </p>
                              <p className="text-sm font-medium truncate">
                                {p.descripcion}
                              </p>
                            </div>
                            {p.codigo_barra ? (
                              <Badge variant="outline" className="font-mono text-xs shrink-0">
                                {p.codigo_barra}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs shrink-0">
                                sin código
                              </Badge>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </ScrollArea>
              </>
            ) : (
              <div className="space-y-4">
                <div className="border rounded-md p-4 bg-muted/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-mono text-muted-foreground">
                        {selected.codigo_articulo}
                      </p>
                      <p className="text-base font-semibold">
                        {selected.descripcion}
                      </p>
                      {selected.codigo_barra && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Actual:{' '}
                          <span className="font-mono">{selected.codigo_barra}</span>
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelected(null);
                        setCodigoBarra('');
                        setTimeout(() => searchRef.current?.focus(), 50);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="codigo-barra-input">
                    2. Escaneá o ingresá el código de barras
                  </Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="codigo-barra-input"
                      ref={barcodeRef}
                      className="font-mono text-lg h-12"
                      placeholder="Escaneá con el lector o escribí el código..."
                      value={codigoBarra}
                      onChange={(e) => setCodigoBarra(e.target.value)}
                      onKeyDown={handleBarcodeKeyDown}
                      autoComplete="off"
                    />
                    <Button
                      onClick={handleGuardar}
                      disabled={saving || !codigoBarra.trim()}
                      className="h-12"
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Guardar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Presioná Enter para guardar y volver al buscador. Esc cancela.
                  </p>
                </div>
              </div>
            )}

            {historial.length > 0 && (
              <div className="border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Cargados en esta sesión ({historial.length})
                </p>
                <ScrollArea className="max-h-40">
                  <ul className="space-y-1">
                    {historial.map((h) => (
                      <li
                        key={`${h.id}-${h.at}`}
                        className="flex items-center justify-between text-sm gap-2 py-1"
                      >
                        <span className="truncate">
                          <span className="font-mono text-xs text-muted-foreground">
                            {h.codigo_articulo}
                          </span>{' '}
                          — {h.descripcion}
                        </span>
                        <Badge variant="outline" className="font-mono text-xs shrink-0">
                          {h.codigo_barra}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmState}
        onOpenChange={(o) => !o && setConfirmState(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar</AlertDialogTitle>
            <AlertDialogDescription>{confirmState?.mensaje}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmState?.onConfirm()}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}