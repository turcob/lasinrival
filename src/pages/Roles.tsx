import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Save, Shield, Percent } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';

type AppRole = 'admin' | 'encargado' | 'cajero' | 'vendedor' | 'deposito';
type AppPermission = 'ver' | 'crear' | 'editar' | 'eliminar' | 'anular' | 'exportar';

interface RolePermission {
  id: string;
  role: AppRole;
  modulo: string;
  permiso: AppPermission;
}

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador',
  encargado: 'Encargado',
  cajero: 'Cajero',
  vendedor: 'Vendedor',
  deposito: 'Depósito',
};

const roleDescriptions: Record<AppRole, string> = {
  admin: 'Acceso completo a todas las funciones del sistema',
  encargado: 'Gestión de ventas, inventario y reportes',
  cajero: 'Operaciones de caja y ventas',
  vendedor: 'Registro de ventas y consultas',
  deposito: 'Gestión de inventario y stock',
};

const roleColors: Record<AppRole, string> = {
  admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  encargado: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  cajero: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  vendedor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  deposito: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

const allRoles: AppRole[] = ['admin', 'encargado', 'cajero', 'vendedor', 'deposito'];
const allPermissions: AppPermission[] = ['ver', 'crear', 'editar', 'eliminar', 'anular', 'exportar'];

const permissionLabels: Record<AppPermission, string> = {
  ver: 'Ver',
  crear: 'Crear',
  editar: 'Editar',
  eliminar: 'Eliminar',
  anular: 'Anular',
  exportar: 'Exportar',
};

const modules = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'productos', label: 'Productos' },
  { key: 'categorias', label: 'Categorías' },
  { key: 'subcategorias', label: 'Subcategorías' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'ventas', label: 'Ventas' },
  { key: 'cajas', label: 'Cajas' },
  { key: 'inventario', label: 'Inventario' },
  { key: 'precios', label: 'Precios' },
  { key: 'reportes', label: 'Reportes' },
  { key: 'usuarios', label: 'Usuarios' },
  { key: 'roles', label: 'Roles' },
];

export default function Roles() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [discountLimits, setDiscountLimits] = useState<Record<string, number>>({});
  const [pendingDiscountChanges, setPendingDiscountChanges] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole>('encargado');
  const [pendingChanges, setPendingChanges] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [permissionsRes, discountsRes] = await Promise.all([
        supabase.from('role_permissions').select('*').order('role, modulo, permiso'),
        supabase.from('configuracion_descuentos').select('role, descuento_maximo_global')
      ]);

      if (permissionsRes.error) throw permissionsRes.error;
      setPermissions(permissionsRes.data || []);

      if (discountsRes.data) {
        const limits: Record<string, number> = {};
        discountsRes.data.forEach(d => {
          limits[d.role] = d.descuento_maximo_global;
        });
        setDiscountLimits(limits);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const getDiscountLimit = (role: AppRole): number => {
    if (pendingDiscountChanges[role] !== undefined) {
      return pendingDiscountChanges[role];
    }
    return discountLimits[role] ?? 0;
  };

  const handleDiscountLimitChange = (role: AppRole, value: string) => {
    const numValue = parseFloat(value.replace(',', '.'));
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
      setPendingDiscountChanges(prev => ({ ...prev, [role]: numValue }));
    } else if (value === '') {
      setPendingDiscountChanges(prev => ({ ...prev, [role]: 0 }));
    }
  };

  const hasPermission = (role: AppRole, modulo: string, permiso: AppPermission): boolean => {
    const key = `${role}-${modulo}-${permiso}`;
    if (pendingChanges.has(key)) {
      return pendingChanges.get(key) as boolean;
    }
    return permissions.some(
      (p) => p.role === role && p.modulo === modulo && p.permiso === permiso
    );
  };

  const togglePermission = (role: AppRole, modulo: string, permiso: AppPermission) => {
    const key = `${role}-${modulo}-${permiso}`;
    const currentValue = hasPermission(role, modulo, permiso);
    setPendingChanges((prev) => {
      const newMap = new Map(prev);
      newMap.set(key, !currentValue);
      return newMap;
    });
  };

  const handleSaveChanges = async () => {
    const hasPermissionChanges = pendingChanges.size > 0;
    const hasDiscountChanges = Object.keys(pendingDiscountChanges).length > 0;

    if (!hasPermissionChanges && !hasDiscountChanges) {
      toast.info('No hay cambios pendientes');
      return;
    }

    setSaving(true);
    try {
      // Save permission changes
      for (const [key, shouldHave] of pendingChanges.entries()) {
        const [role, modulo, permiso] = key.split('-') as [AppRole, string, AppPermission];
        const existing = permissions.find(
          (p) => p.role === role && p.modulo === modulo && p.permiso === permiso
        );

        if (shouldHave && !existing) {
          const { error } = await supabase
            .from('role_permissions')
            .insert({ role, modulo, permiso });
          if (error) throw error;
        } else if (!shouldHave && existing) {
          const { error } = await supabase
            .from('role_permissions')
            .delete()
            .eq('id', existing.id);
          if (error) throw error;
        }
      }

      // Save discount limit changes
      for (const [role, limit] of Object.entries(pendingDiscountChanges)) {
        const { data: existing } = await supabase
          .from('configuracion_descuentos')
          .select('id')
          .eq('role', role)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from('configuracion_descuentos')
            .update({ descuento_maximo_global: limit })
            .eq('role', role);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('configuracion_descuentos')
            .insert({ role, descuento_maximo_global: limit });
          if (error) throw error;
        }
      }

      toast.success('Cambios guardados correctamente');
      setPendingChanges(new Map());
      setPendingDiscountChanges({});
      await fetchData();
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  const toggleAllModulePermissions = (role: AppRole, modulo: string, enable: boolean) => {
    allPermissions.forEach((permiso) => {
      const key = `${role}-${modulo}-${permiso}`;
      setPendingChanges((prev) => {
        const newMap = new Map(prev);
        newMap.set(key, enable);
        return newMap;
      });
    });
  };

  const getModulePermissionCount = (role: AppRole, modulo: string): number => {
    return allPermissions.filter((permiso) => hasPermission(role, modulo, permiso)).length;
  };

  if (!isAdmin) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Shield className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Acceso Restringido</h2>
            <p className="text-muted-foreground">
              No tienes permisos para acceder a esta sección.
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader title="Roles y Permisos" description="Gestión de permisos y descuentos por rol">
        {(pendingChanges.size > 0 || Object.keys(pendingDiscountChanges).length > 0) && (
          <Button onClick={handleSaveChanges} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Guardando...' : `Guardar (${pendingChanges.size + Object.keys(pendingDiscountChanges).length} cambios)`}
          </Button>
        )}
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <Tabs value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
          <TabsList className="mb-6">
            {allRoles.filter(r => r !== 'admin').map((role) => (
              <TabsTrigger key={role} value={role} className="gap-2">
                <Badge className={roleColors[role]}>{roleLabels[role]}</Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {allRoles.filter(r => r !== 'admin').map((role) => (
            <TabsContent key={role} value={role}>
              {/* Card de configuración del rol */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Badge className={roleColors[role]}>{roleLabels[role]}</Badge>
                  </CardTitle>
                  <CardDescription>{roleDescriptions[role]}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Percent className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor={`discount-${role}`} className="text-sm font-medium">
                        Descuento máximo permitido:
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`discount-${role}`}
                        type="text"
                        inputMode="decimal"
                        className="w-20 text-center"
                        value={pendingDiscountChanges[role] !== undefined ? pendingDiscountChanges[role].toString() : (discountLimits[role]?.toString() ?? '0')}
                        onChange={(e) => handleDiscountLimitChange(role, e.target.value)}
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                    {pendingDiscountChanges[role] !== undefined && (
                      <Badge variant="secondary" className="text-xs">Modificado</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {modules.map((module) => (
                  <Card key={module.key}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{module.label}</CardTitle>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => toggleAllModulePermissions(role, module.key, true)}
                          >
                            Todos
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => toggleAllModulePermissions(role, module.key, false)}
                          >
                            Ninguno
                          </Button>
                        </div>
                      </div>
                      <CardDescription>
                        {getModulePermissionCount(role, module.key)} de {allPermissions.length} permisos activos
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-2">
                        {allPermissions.map((permiso) => (
                          <div key={permiso} className="flex items-center space-x-2">
                            <Checkbox
                              id={`${role}-${module.key}-${permiso}`}
                              checked={hasPermission(role, module.key, permiso)}
                              onCheckedChange={() => togglePermission(role, module.key, permiso)}
                            />
                            <label
                              htmlFor={`${role}-${module.key}-${permiso}`}
                              className="text-sm cursor-pointer"
                            >
                              {permissionLabels[permiso]}
                            </label>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}

      <Card className="mt-6 border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Badge className={roleColors.admin}>Administrador</Badge>
            <span className="text-muted-foreground font-normal">- Permisos completos</span>
          </CardTitle>
          <CardDescription>
            El rol de Administrador tiene acceso completo a todas las funciones del sistema. 
            Sus permisos no pueden ser modificados.
          </CardDescription>
        </CardHeader>
      </Card>
    </MainLayout>
  );
}
