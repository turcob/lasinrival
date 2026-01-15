import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Save, Building2, MapPin, Phone, Mail, AlertTriangle, CheckCircle2, Palette } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface ConfiguracionComercio {
  id?: string;
  razon_social: string;
  nombre_fantasia: string;
  cuit: string;
  direccion: string;
  localidad: string;
  provincia: string;
  codigo_postal: string;
  telefono: string;
  email: string;
  condicion_iva: string;
  inicio_actividades: string;
  punto_venta: number;
  afip_modo: 'homologacion' | 'produccion';
  nombre_sistema: string;
  texto_login_footer: string;
}

const CONDICIONES_IVA = [
  "IVA Responsable Inscripto",
  "IVA Sujeto Exento",
  "Responsable Monotributo",
];

const PROVINCIAS = [
  "Buenos Aires",
  "CABA",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
];

const initialFormData: ConfiguracionComercio = {
  razon_social: '',
  nombre_fantasia: '',
  cuit: '',
  direccion: '',
  localidad: '',
  provincia: '',
  codigo_postal: '',
  telefono: '',
  email: '',
  condicion_iva: 'IVA Responsable Inscripto',
  inicio_actividades: '',
  punto_venta: 1,
  afip_modo: 'homologacion',
  nombre_sistema: 'GestiónPro',
  texto_login_footer: 'Sistema de Gestión Comercial © 2024',
};

export default function Configuracion() {
  const { hasRole } = useAuth();
  const [formData, setFormData] = useState<ConfiguracionComercio>(initialFormData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);

  const isAdmin = hasRole('admin');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracion_comercio')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfigId(data.id);
        setFormData({
          id: data.id,
          razon_social: data.razon_social || '',
          nombre_fantasia: data.nombre_fantasia || '',
          cuit: data.cuit || '',
          direccion: data.direccion || '',
          localidad: data.localidad || '',
          provincia: data.provincia || '',
          codigo_postal: data.codigo_postal || '',
          telefono: data.telefono || '',
          email: data.email || '',
          condicion_iva: data.condicion_iva || 'IVA Responsable Inscripto',
          inicio_actividades: data.inicio_actividades || '',
          punto_venta: data.punto_venta || 1,
          afip_modo: (data as any).afip_modo || 'homologacion',
          nombre_sistema: (data as any).nombre_sistema || 'GestiónPro',
          texto_login_footer: (data as any).texto_login_footer || 'Sistema de Gestión Comercial © 2024',
        });
      }
    } catch (error) {
      console.error('Error fetching config:', error);
      toast.error('Error al cargar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const formatCuit = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 10) return `${numbers.slice(0, 2)}-${numbers.slice(2)}`;
    return `${numbers.slice(0, 2)}-${numbers.slice(2, 10)}-${numbers.slice(10, 11)}`;
  };

  const handleCuitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCuit(e.target.value);
    if (formatted.replace(/\D/g, '').length <= 11) {
      setFormData({ ...formData, cuit: formatted });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.razon_social.trim()) {
      toast.error('La razón social es obligatoria');
      return;
    }
    if (!formData.cuit.trim()) {
      toast.error('El CUIT es obligatorio');
      return;
    }
    if (!formData.direccion.trim()) {
      toast.error('La dirección es obligatoria');
      return;
    }

    setSaving(true);
    try {
      const cleanCuit = formData.cuit.replace(/\D/g, '');
      
      const dataToSave = {
        razon_social: formData.razon_social.trim(),
        nombre_fantasia: formData.nombre_fantasia.trim() || null,
        cuit: cleanCuit,
        direccion: formData.direccion.trim(),
        localidad: formData.localidad.trim() || null,
        provincia: formData.provincia || null,
        codigo_postal: formData.codigo_postal.trim() || null,
        telefono: formData.telefono.trim() || null,
        email: formData.email.trim() || null,
        condicion_iva: formData.condicion_iva,
        inicio_actividades: formData.inicio_actividades || null,
        punto_venta: formData.punto_venta,
        afip_modo: formData.afip_modo,
        nombre_sistema: formData.nombre_sistema.trim() || 'GestiónPro',
        texto_login_footer: formData.texto_login_footer.trim() || 'Sistema de Gestión Comercial © 2024',
      };

      if (configId) {
        const { error } = await supabase
          .from('configuracion_comercio')
          .update(dataToSave)
          .eq('id', configId);
        
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('configuracion_comercio')
          .insert(dataToSave)
          .select()
          .single();
        
        if (error) throw error;
        setConfigId(data.id);
      }

      toast.success('Configuración guardada correctamente');
    } catch (error: any) {
      console.error('Error saving config:', error);
      toast.error('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader
        title="Configuración del Comercio"
        description="Administra los datos de tu comercio para facturación electrónica"
      />

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Datos Fiscales */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Datos Fiscales
              </CardTitle>
              <CardDescription>
                Información fiscal requerida para facturación AFIP
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="razon_social">Razón Social *</Label>
                <Input
                  id="razon_social"
                  value={formData.razon_social}
                  onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })}
                  placeholder="Mi Empresa S.R.L."
                  disabled={!isAdmin}
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nombre_fantasia">Nombre de Fantasía</Label>
                <Input
                  id="nombre_fantasia"
                  value={formData.nombre_fantasia}
                  onChange={(e) => setFormData({ ...formData, nombre_fantasia: e.target.value })}
                  placeholder="Mi Tienda"
                  disabled={!isAdmin}
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cuit">CUIT *</Label>
                <Input
                  id="cuit"
                  value={formData.cuit}
                  onChange={handleCuitChange}
                  placeholder="20-12345678-9"
                  disabled={!isAdmin}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="condicion_iva">Condición frente al IVA</Label>
                <Select
                  value={formData.condicion_iva}
                  onValueChange={(value) => setFormData({ ...formData, condicion_iva: value })}
                  disabled={!isAdmin}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDICIONES_IVA.map((cond) => (
                      <SelectItem key={cond} value={cond}>
                        {cond}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inicio_actividades">Inicio de Actividades</Label>
                  <Input
                    id="inicio_actividades"
                    type="date"
                    value={formData.inicio_actividades}
                    onChange={(e) => setFormData({ ...formData, inicio_actividades: e.target.value })}
                    disabled={!isAdmin}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="punto_venta">Punto de Venta</Label>
                  <Input
                    id="punto_venta"
                    type="number"
                    min={1}
                    max={9999}
                    value={formData.punto_venta}
                    onChange={(e) => setFormData({ ...formData, punto_venta: parseInt(e.target.value) || 1 })}
                    disabled={!isAdmin}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configuración AFIP */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {formData.afip_modo === 'produccion' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                )}
                Modo AFIP
              </CardTitle>
              <CardDescription>
                Configuración del entorno de facturación electrónica
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <div className="font-medium">
                    {formData.afip_modo === 'produccion' ? 'Modo Producción' : 'Modo Homologación (Testing)'}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formData.afip_modo === 'produccion' 
                      ? 'Las facturas se emiten con validez fiscal real. Asegurate de tener los certificados de producción configurados.'
                      : 'Las facturas se emiten en modo prueba. No tienen validez fiscal.'
                    }
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${formData.afip_modo === 'homologacion' ? 'text-amber-600' : 'text-muted-foreground'}`}>
                    Testing
                  </span>
                  <Switch
                    checked={formData.afip_modo === 'produccion'}
                    onCheckedChange={(checked) => setFormData({ ...formData, afip_modo: checked ? 'produccion' : 'homologacion' })}
                    disabled={!isAdmin}
                  />
                  <span className={`text-sm font-medium ${formData.afip_modo === 'produccion' ? 'text-green-600' : 'text-muted-foreground'}`}>
                    Producción
                  </span>
                </div>
              </div>
              {formData.afip_modo === 'produccion' && (
                <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800 dark:text-amber-200">
                      <p className="font-medium">Importante: Modo Producción activo</p>
                      <p className="mt-1">
                        Asegurate de haber configurado los certificados de producción de AFIP antes de emitir facturas.
                        Las facturas emitidas en este modo tienen validez fiscal.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Datos de Contacto */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Ubicación y Contacto
              </CardTitle>
              <CardDescription>
                Dirección y datos de contacto del comercio
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="direccion">Dirección *</Label>
                <Input
                  id="direccion"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  placeholder="Av. Principal 123"
                  disabled={!isAdmin}
                  maxLength={200}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="localidad">Localidad</Label>
                  <Input
                    id="localidad"
                    value={formData.localidad}
                    onChange={(e) => setFormData({ ...formData, localidad: e.target.value })}
                    placeholder="Ciudad"
                    disabled={!isAdmin}
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codigo_postal">Código Postal</Label>
                  <Input
                    id="codigo_postal"
                    value={formData.codigo_postal}
                    onChange={(e) => setFormData({ ...formData, codigo_postal: e.target.value })}
                    placeholder="1234"
                    disabled={!isAdmin}
                    maxLength={10}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="provincia">Provincia</Label>
                <Select
                  value={formData.provincia}
                  onValueChange={(value) => setFormData({ ...formData, provincia: value })}
                  disabled={!isAdmin}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar provincia" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVINCIAS.map((prov) => (
                      <SelectItem key={prov} value={prov}>
                        {prov}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="telefono"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    placeholder="+54 11 1234-5678"
                    className="pl-10"
                    disabled={!isAdmin}
                    maxLength={30}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contacto@miempresa.com"
                    className="pl-10"
                    disabled={!isAdmin}
                    maxLength={100}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personalización del Sistema */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Personalización del Sistema
              </CardTitle>
              <CardDescription>
                Configura el nombre y textos que aparecen en la aplicación
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre_sistema">Nombre del Sistema</Label>
                <Input
                  id="nombre_sistema"
                  value={formData.nombre_sistema}
                  onChange={(e) => setFormData({ ...formData, nombre_sistema: e.target.value })}
                  placeholder="GestiónPro"
                  disabled={!isAdmin}
                  maxLength={50}
                />
                <p className="text-xs text-muted-foreground">
                  Este nombre aparece en el menú lateral y en la pantalla de login
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="texto_login_footer">Texto del pie de página (Login)</Label>
                <Input
                  id="texto_login_footer"
                  value={formData.texto_login_footer}
                  onChange={(e) => setFormData({ ...formData, texto_login_footer: e.target.value })}
                  placeholder="Sistema de Gestión Comercial © 2024"
                  disabled={!isAdmin}
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">
                  Este texto aparece en la parte inferior de la pantalla de inicio de sesión
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {isAdmin && (
          <div className="mt-6 flex justify-end">
            <Button type="submit" disabled={saving} size="lg">
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Guardando...' : 'Guardar Configuración'}
            </Button>
          </div>
        )}

        {!isAdmin && (
          <div className="mt-6 p-4 bg-muted rounded-lg text-center text-muted-foreground">
            Solo los administradores pueden modificar la configuración del comercio.
          </div>
        )}
      </form>
    </MainLayout>
  );
}
