import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, LogOut, RefreshCw, Camera, ImageIcon, CheckCircle2, Sparkles, AlertTriangle, ShieldCheck, FileText, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { tomarFotoNativa } from '@/lib/nativeCamera';

// Helper: mask select strings from supabase-js type parser
const sel = (s: string): string => s;

interface TransferenciaRow {
  id: string;
  venta_id: string | null;
  cliente_id: string | null;
  titular_nombre: string | null;
  importe: number;
  fecha_transferencia: string | null;
  estado: string;
  foto_comprobante_path: string | null;
  foto_comprobante_nombre: string | null;
  created_at: string;
  origen: string | null;
  numero_operacion?: string | null;
  titular_cuil?: string | null;
  banco?: string | null;
}

interface VentaRow {
  id: string;
  numero_comprobante: number | null;
  fecha: string | null;
  cliente_id: string | null;
  usuario_id: string | null;
  total?: number | null;
}

interface ClienteRow {
  id: string;
  nombre: string;
}

interface FilaTransf {
  transferencia: TransferenciaRow;
  venta: VentaRow | null;
  clienteNombre: string | null;
}

const money = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n || 0);

const MAX_FILE_MB = 10;

type Rango = '1h' | 'hoy' | '7d' | '60d';

const RANGOS: { value: Rango; label: string }[] = [
  { value: '1h', label: 'Última hora' },
  { value: 'hoy', label: 'Hoy' },
  { value: '7d', label: '7 días' },
  { value: '60d', label: '60 días' },
];

const desdeDeRango = (r: Rango): Date => {
  const d = new Date();
  if (r === '1h') { d.setHours(d.getHours() - 1); return d; }
  if (r === 'hoy') { d.setHours(0, 0, 0, 0); return d; }
  if (r === '7d') { d.setDate(d.getDate() - 7); return d; }
  d.setDate(d.getDate() - 60);
  return d;
};

const esPdf = (nombre?: string | null, tipo?: string | null) => {
  if (tipo && tipo.toLowerCase().includes('pdf')) return true;
  return !!nombre && nombre.toLowerCase().endsWith('.pdf');
};

const estadoBadge = (e: string) => {
  if (e === 'pendiente') return 'bg-amber-500/10 text-amber-700 border-amber-500/30';
  if (e === 'validada') return 'bg-green-500/10 text-green-700 border-green-500/30';
  if (e === 'rechazada') return 'bg-red-500/10 text-red-700 border-red-500/30';
  return 'bg-muted text-muted-foreground';
};

export default function SubirFotos() {
  const { user, profile, loading, signOut, hasRole } = useAuth();
  const puedeValidar = hasRole('admin') || hasRole('encargado') || hasRole('administracion');
  const [filas, setFilas] = useState<FilaTransf[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [analizandoId, setAnalizandoId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [validandoLote, setValidandoLote] = useState(false);
  const [previewFila, setPreviewFila] = useState<FilaTransf | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [rango, setRango] = useState<Rango>('1h');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFilaRef = useRef<FilaTransf | null>(null);

  const fetchData = async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      const desde = desdeDeRango(rango);

      const { data: transfData, error: transfErr } = await supabase
        .from('transferencias')
        .select(sel('id, venta_id, cliente_id, titular_nombre, importe, fecha_transferencia, estado, foto_comprobante_path, foto_comprobante_nombre, created_at, origen, numero_operacion, titular_cuil, banco'))
        .gte('created_at', desde.toISOString())
        .order('created_at', { ascending: false })
        .returns<TransferenciaRow[]>();

      if (transfErr) throw transfErr;
      const transferencias = transfData || [];

      const ventaIds = Array.from(
        new Set(transferencias.map((t) => t.venta_id).filter((v): v is string => !!v))
      );

      let ventasMap = new Map<string, VentaRow>();
      let clientesMap = new Map<string, string>();

      if (ventaIds.length > 0) {
        const { data: ventasData, error: ventasErr } = await supabase
          .from('ventas')
          .select(sel('id, numero_comprobante, fecha, cliente_id, usuario_id, total'))
          .in('id', ventaIds)
          .returns<VentaRow[]>();
        if (ventasErr) throw ventasErr;
        (ventasData || []).forEach((v) => ventasMap.set(v.id, v));

        const clienteIds = Array.from(
          new Set(
            (ventasData || [])
              .map((v) => v.cliente_id)
              .filter((c): c is string => !!c)
          )
        );
        if (clienteIds.length > 0) {
          const { data: clientesData } = await supabase
            .from('clientes')
            .select(sel('id, nombre'))
            .in('id', clienteIds)
            .returns<ClienteRow[]>();
          (clientesData || []).forEach((c) => clientesMap.set(c.id, c.nombre));
        }
      }

      // Filtro de ownership en cliente: venta.usuario_id === user.id
      // Admin/encargado/administracion ven todas para poder validar en lote.
      const misFilas: FilaTransf[] = transferencias
        .filter((t) => {
          if (puedeValidar) return true;
          if (!t.venta_id) return false;
          const v = ventasMap.get(t.venta_id);
          return v?.usuario_id === user.id;
        })
        .map((t) => {
          const venta = t.venta_id ? ventasMap.get(t.venta_id) || null : null;
          const clienteNombre = venta?.cliente_id
            ? clientesMap.get(venta.cliente_id) || null
            : null;
          return { transferencia: t, venta, clienteNombre };
        });

      setFilas(misFilas);
    } catch (e: any) {
      console.error('[SubirFotos] fetch error', e);
      toast.error(e.message || 'Error al cargar transferencias');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (user) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, rango]);

  const { sinFoto, conFoto, coincidentes, revisar, pendientesValidar } = useMemo(() => {
    const sf: FilaTransf[] = [];
    const cf: FilaTransf[] = [];
    const ok: FilaTransf[] = [];
    const rev: FilaTransf[] = [];
    const pv: FilaTransf[] = [];
    filas.forEach((f) => {
      if (f.transferencia.foto_comprobante_path) cf.push(f);
      else sf.push(f);
      if (f.transferencia.estado === 'pendiente' && f.transferencia.foto_comprobante_path) {
        pv.push(f);
        if (matchStatus(f) === 'coincide') ok.push(f);
        else rev.push(f);
      }
    });
    return { sinFoto: sf, conFoto: cf, coincidentes: ok, revisar: rev, pendientesValidar: pv };
  }, [filas]);

  const handleSubirClick = async (fila: FilaTransf) => {
    pendingFilaRef.current = fila;
    const nativa = await tomarFotoNativa();
    if (nativa) {
      await procesarUpload(fila, nativa);
      pendingFilaRef.current = null;
    } else {
      // Fallback web
      fileInputRef.current?.click();
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const fila = pendingFilaRef.current;
    pendingFilaRef.current = null;
    if (!file || !fila) return;
    const pdf = esPdf(file.name, file.type);
    if (!pdf && !file.type.startsWith('image/')) {
      toast.error('Sólo se permiten imágenes o PDF');
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`El archivo supera los ${MAX_FILE_MB} MB`);
      return;
    }
    await procesarUpload(fila, file);
  };

  const procesarUpload = async (fila: FilaTransf, file: File) => {
    const transferenciaId = fila.transferencia.id;
    setUploadingId(transferenciaId);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `transferencias/${transferenciaId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    try {
      const { error: upErr } = await supabase.storage
        .from('comprobantes-cobros')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'image/jpeg',
        });
      if (upErr) {
        toast.error('No se pudo subir el archivo');
        return;
      }

      const { error: rpcErr } = await supabase.rpc('adjuntar_comprobante_transferencia', {
        p_transferencia_id: transferenciaId,
        p_path: path,
        p_nombre: file.name,
      });

      if (rpcErr) {
        toast.error(
          `Archivo subido pero NO quedó adjuntado: ${rpcErr.message}. Avisá al administrador.`
        );
        return;
      }

      toast.success('Comprobante adjuntado');
      // Auto-OCR con IA para autocompletar datos sin intervención del usuario.
      // Si el modelo no puede leer el PDF, la transferencia queda adjuntada igual.
      analizarConIA(transferenciaId, file).catch((e) => {
        console.warn('[SubirFotos] OCR falló', e);
      });
      await fetchData();
    } catch (e: any) {
      console.error('[SubirFotos] upload error', e);
      toast.error(e.message || 'Error inesperado');
    } finally {
      setUploadingId(null);
    }
  };

  const analizarConIA = async (transferenciaId: string, file: File) => {
    setAnalizandoId(transferenciaId);
    try {
      const base64 = await fileToBase64(file);
      const mimeType = esPdf(file.name, file.type)
        ? 'application/pdf'
        : file.type || 'image/jpeg';
      const { data, error } = await supabase.functions.invoke('extraer-numero-operacion', {
        body: { imageBase64: base64, mimeType },
      });
      if (error) throw error;
      const r = data as any;
      if (!r || (typeof r === 'object' && r.error)) throw new Error(r?.error || 'OCR error');

      const update: Record<string, any> = {};
      if (r.numero_operacion) update.numero_operacion = r.numero_operacion;
      if (r.fecha) update.fecha_transferencia = r.fecha;
      if (r.cuil_titular) update.titular_cuil = r.cuil_titular;
      if (r.titular) update.titular_nombre = r.titular;
      if (r.banco) update.banco = r.banco;

      if (Object.keys(update).length > 0) {
        const { error: upErr } = await supabase
          .from('transferencias')
          .update(update)
          .eq('id', transferenciaId);
        if (!upErr) {
          toast.success('Datos autocompletados con IA');
          await fetchData();
        }
      }
    } finally {
      setAnalizandoId(null);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const seleccionarCoincidentes = () => {
    setSelectedIds(new Set(coincidentes.map((f) => f.transferencia.id)));
  };

  const validarSeleccionadas = async () => {
    if (selectedIds.size === 0) return;
    setValidandoLote(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from('transferencias')
        .update({ estado: 'validada' })
        .in('id', ids);
      if (error) throw error;
      toast.success(`${ids.length} transferencia(s) validada(s)`);
      setSelectedIds(new Set());
      await fetchData();
    } catch (e: any) {
      toast.error(e.message || 'No se pudo validar el lote');
    } finally {
      setValidandoLote(false);
    }
  };

  const abrirPreview = async (fila: FilaTransf) => {
    setPreviewFila(fila);
    setPreviewUrl(null);
    if (!fila.transferencia.foto_comprobante_path) return;
    setPreviewLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from('comprobantes-cobros')
        .createSignedUrl(fila.transferencia.foto_comprobante_path, 60 * 10);
      if (error || !data?.signedUrl) throw error || new Error('No se pudo generar URL');
      setPreviewUrl(data.signedUrl);
    } catch (e: any) {
      console.error('[SubirFotos] signed url error', e);
      toast.error('No se pudo cargar la imagen');
    } finally {
      setPreviewLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth?redirect=/subir-fotos" replace />;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="max-w-md mx-auto p-3 flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="font-semibold leading-tight">Subir comprobantes</h1>
            <p className="text-xs text-muted-foreground truncate">{profile?.nombre}</p>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => fetchData()} disabled={loadingData}>
              <RefreshCw className={`h-4 w-4 ${loadingData ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-3">
        <div className="flex gap-1 mb-3 overflow-x-auto">
          {RANGOS.map((r) => (
            <Button
              key={r.value}
              size="sm"
              variant={rango === r.value ? 'default' : 'outline'}
              className="shrink-0"
              onClick={() => setRango(r.value)}
            >
              {r.label}
            </Button>
          ))}
        </div>
        <Tabs defaultValue="sin" className="w-full">
          <TabsList className={`grid ${puedeValidar ? 'grid-cols-3' : 'grid-cols-2'} w-full`}>
            <TabsTrigger value="sin">Sin comprobante ({sinFoto.length})</TabsTrigger>
            <TabsTrigger value="con">Con comprobante ({conFoto.length})</TabsTrigger>
            {puedeValidar && (
              <TabsTrigger value="validar">Validar ({pendientesValidar.length})</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="sin" className="space-y-2 mt-3">
            {loadingData ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : sinFoto.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Camera className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Sin transferencias pendientes de foto</p>
              </div>
            ) : (
              sinFoto.map((f) => (
                <FilaCard
                  key={f.transferencia.id}
                  fila={f}
                  loading={uploadingId === f.transferencia.id}
                  analizando={analizandoId === f.transferencia.id}
                  onSubir={() => handleSubirClick(f)}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="con" className="space-y-2 mt-3">
            {loadingData ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : conFoto.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Sin transferencias adjuntadas todavía</p>
              </div>
            ) : (
              conFoto.map((f) => (
                <FilaCard
                  key={f.transferencia.id}
                  fila={f}
                  analizando={analizandoId === f.transferencia.id}
                  conFoto
                  onVer={() => abrirPreview(f)}
                />
              ))
            )}
          </TabsContent>

          {puedeValidar && (
            <TabsContent value="validar" className="space-y-2 mt-3">
              {pendientesValidar.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <ShieldCheck className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Sin transferencias pendientes de validar</p>
                </div>
              ) : (
                <>
                  <div className="flex gap-2 sticky top-14 bg-muted/30 py-2 z-10">
                    <Button size="sm" variant="outline" className="flex-1" onClick={seleccionarCoincidentes} disabled={coincidentes.length === 0}>
                      Seleccionar coincidentes ({coincidentes.length})
                    </Button>
                    <Button size="sm" className="flex-1" onClick={validarSeleccionadas} disabled={selectedIds.size === 0 || validandoLote}>
                      {validandoLote ? <Loader2 className="h-4 w-4 animate-spin" /> : `Validar (${selectedIds.size})`}
                    </Button>
                  </div>
                  {coincidentes.length > 0 && (
                    <p className="text-xs font-medium text-green-700 mt-2">Coincidentes</p>
                  )}
                  {coincidentes.map((f) => (
                    <FilaCard
                      key={f.transferencia.id}
                      fila={f}
                      conFoto
                      selectable
                      selected={selectedIds.has(f.transferencia.id)}
                      onToggle={() => toggleSelected(f.transferencia.id)}
                      onVer={() => abrirPreview(f)}
                    />
                  ))}
                  {revisar.length > 0 && (
                    <p className="text-xs font-medium text-amber-700 mt-3">Revisar</p>
                  )}
                  {revisar.map((f) => (
                    <FilaCard
                      key={f.transferencia.id}
                      fila={f}
                      conFoto
                      selectable
                      selected={selectedIds.has(f.transferencia.id)}
                      onToggle={() => toggleSelected(f.transferencia.id)}
                      onVer={() => abrirPreview(f)}
                    />
                  ))}
                </>
              )}
            </TabsContent>
          )}
        </Tabs>
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleFileInputChange}
      />

      <Sheet open={!!previewFila} onOpenChange={(o) => { if (!o) { setPreviewFila(null); setPreviewUrl(null); } }}>
        <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              Comprobante {previewFila?.venta?.numero_comprobante ? `#${previewFila.venta.numero_comprobante}` : ''}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {previewFila && (
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Titular:</span> {previewFila.transferencia.titular_nombre || '—'}</p>
                <p><span className="text-muted-foreground">Importe:</span> {money(Number(previewFila.transferencia.importe))}</p>
                {previewFila.clienteNombre && (
                  <p><span className="text-muted-foreground">Cliente:</span> {previewFila.clienteNombre}</p>
                )}
              </div>
            )}
            <div className="flex justify-center items-center min-h-[300px] bg-muted/30 rounded">
              {previewLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : previewUrl && esPdf(previewFila?.transferencia.foto_comprobante_nombre, null) ? (
                <div className="w-full">
                  <iframe src={previewUrl} title="Comprobante PDF" className="w-full h-[55vh] rounded border-0" />
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 text-sm text-primary py-3 underline"
                  >
                    <ExternalLink className="h-4 w-4" /> Abrir en pestaña nueva
                  </a>
                </div>
              ) : previewUrl ? (
                <img src={previewUrl} alt="Comprobante" className="max-w-full max-h-[60vh] object-contain" />
              ) : (
                <p className="text-sm text-muted-foreground">Sin imagen</p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

interface FilaCardProps {
  fila: FilaTransf;
  loading?: boolean;
  analizando?: boolean;
  conFoto?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggle?: () => void;
  onSubir?: () => void;
  onVer?: () => void;
}

function FilaCard({ fila, loading, analizando, conFoto, selectable, selected, onToggle, onSubir, onVer }: FilaCardProps) {
  const { transferencia: t, venta, clienteNombre } = fila;
  const fecha = t.fecha_transferencia || venta?.fecha || t.created_at;
  const match = matchStatus(fila);
  return (
    <Card className={conFoto ? 'active:scale-[0.99] transition cursor-pointer' : ''} onClick={conFoto ? onVer : undefined}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          {selectable && (
            <div onClick={(e) => e.stopPropagation()} className="shrink-0">
              <Checkbox checked={!!selected} onCheckedChange={() => onToggle?.()} />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold">
                {venta?.numero_comprobante ? `#${venta.numero_comprobante}` : 'Sin nº'}
              </span>
              <Badge variant="outline" className={`text-xs capitalize ${estadoBadge(t.estado)}`}>
                {t.estado}
              </Badge>
              {conFoto && (
                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 border-green-500/30">
                  {esPdf(t.foto_comprobante_nombre, null)
                    ? <><FileText className="h-3 w-3 mr-1" /> PDF</>
                    : <><CheckCircle2 className="h-3 w-3 mr-1" /> Adjuntado</>}
                </Badge>
              )}
              {analizando && (
                <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-700 border-blue-500/30">
                  <Sparkles className="h-3 w-3 mr-1 animate-pulse" /> Analizando IA
                </Badge>
              )}
              {conFoto && !analizando && match === 'coincide' && (
                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 border-green-500/30">
                  Coincide
                </Badge>
              )}
              {conFoto && !analizando && match === 'revisar' && (
                <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-700 border-amber-500/30">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Revisar
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {fecha ? format(new Date(fecha), "d MMM yyyy", { locale: es }) : '—'}
            </p>
            {t.numero_operacion && (
              <p className="text-[11px] text-muted-foreground">Op. {t.numero_operacion}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="font-semibold text-sm">{money(Number(t.importe))}</p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          <p className="truncate"><span className="text-foreground/70">Titular:</span> {t.titular_nombre || '—'}</p>
          {clienteNombre && <p className="truncate"><span className="text-foreground/70">Cliente:</span> {clienteNombre}</p>}
        </div>
        {!conFoto && (
          <Button
            className="w-full"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onSubir?.(); }}
            disabled={loading}
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Subiendo...</>
            ) : (
              <><Camera className="h-4 w-4 mr-2" /> Subir comprobante (foto o PDF)</>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// Helpers
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function matchStatus(f: FilaTransf): 'coincide' | 'revisar' | 'sin_datos' {
  const t = f.transferencia;
  if (!t.numero_operacion || !t.fecha_transferencia) return 'sin_datos';
  const importe = Number(t.importe) || 0;
  const total = Number((f.venta as any)?.total) || 0;
  // Match si hay número de operación, fecha y (si hay venta con total) importe cuadra a $1
  if (total > 0) {
    if (Math.abs(importe - total) <= 1) return 'coincide';
    return 'revisar';
  }
  return 'coincide';
}