import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Save, Shield, Percent, Plus, Edit2, Trash2, Lock, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type AppPermission = 'ver' | 'crear' | 'editar' | 'eliminar' | 'anular' | 'exportar';

interface Role {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  color: string;
  es_sistema: boolean;
  activo: boolean;
  orden: number;
}

interface RolePermission {
  id: string;
  role: string;
  rol_codigo: string | null;
  modulo: string;
  permiso: AppPermission;
}

const colorOptions = [
  { value: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', label: 'Rojo' },
  { value: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', label: 'Azul' },
  { value: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', label: 'Verde' },
  { value: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', label: 'Amarillo' },
  { value: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', label: 'Púrpura' },
  { value: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200', label: 'Rosa' },
  { value: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', label: 'Naranja' },
  { value: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200', label: 'Teal' },
  { value: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200', label: 'Gris' },
];

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
  { key: 'empleados', label: 'Empleados' },
  { key: 'facturacion', label: 'Facturación' },
];

export default function Roles() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [discountLimits, setDiscountLimits] = useState<Record<string, number>>({});
  const [pendingDiscountChanges, setPendingDiscountChanges] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [pendingChanges, setPendingChanges] = useState<Map<string, boolean>>(new Map());
  
  // Dialog states
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRoleForEdit, setSelectedRoleForEdit] = useState<Role | null>(null);
  const [roleFormData, setRoleFormData] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    color: colorOptions[0].value,
    orden: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesRes, permissionsRes, discountsRes] = await Promise.all([
        supabase.from('roles').select('*').eq('activo', true).order('orden'),
        supabase.from('role_permissions').select('*').order('rol_codigo, modulo, permiso'),
        supabase.from('configuracion_descuentos').select('rol_codigo, descuento_maximo_global')
      ]);

      if (rolesRes.error) throw rolesRes.error;
      const rolesData = rolesRes.data || [];
      setRoles(rolesData);
      
      // Set first non-admin role as selected
      const nonAdminRoles = rolesData.filter(r => r.codigo !== 'admin');
      if (nonAdminRoles.length > 0 && !selectedRole) {
        setSelectedRole(nonAdminRoles[0].codigo);
      }

      if (permissionsRes.error) throw permissionsRes.error;
      setPermissions(permissionsRes.data || []);

      if (discountsRes.data) {
        const limits: Record<string, number> = {};
        discountsRes.data.forEach(d => {
          if (d.rol_codigo) limits[d.rol_codigo] = d.descuento_maximo_global;
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

  const handleDiscountLimitChange = (roleCodigo: string, value: string) => {
    const numValue = parseFloat(value.replace(',', '.'));
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
      setPendingDiscountChanges(prev => ({ ...prev, [roleCodigo]: numValue }));
    } else if (value === '') {
      setPendingDiscountChanges(prev => ({ ...prev, [roleCodigo]: 0 }));
    }
  };

  const hasPermission = (roleCodigo: string, modulo: string, permiso: AppPermission): boolean => {
    const key = `${roleCodigo}-${modulo}-${permiso}`;
    if (pendingChanges.has(key)) {
      return pendingChanges.get(key) as boolean;
    }
    return permissions.some(
      (p) => (p.rol_codigo === roleCodigo || p.role === roleCodigo) && p.modulo === modulo && p.permiso === permiso
    );
  };

  const togglePermission = (roleCodigo: string, modulo: string, permiso: AppPermission) => {
    const key = `${roleCodigo}-${modulo}-${permiso}`;
    const currentValue = hasPermission(roleCodigo, modulo, permiso);
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
        const [roleCodigo, modulo, permiso] = key.split('-') as [string, string, AppPermission];
        const existing = permissions.find(
          (p) => (p.rol_codigo === roleCodigo || p.role === roleCodigo) && p.modulo === modulo && p.permiso === permiso
        );

        if (shouldHave && !existing) {
          // Check if roleCodigo is a valid app_role enum
          const validEnumRoles = ['admin', 'encargado', 'cajero', 'vendedor', 'deposito'];
          const roleValue = validEnumRoles.includes(roleCodigo) ? roleCodigo as 'admin' | 'encargado' | 'cajero' | 'vendedor' | 'deposito' : 'vendedor'; // Use vendedor as fallback for enum
          
          const { error } = await supabase
            .from('role_permissions')
            .insert([{ role: roleValue, rol_codigo: roleCodigo, modulo, permiso }]);
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
      for (const [roleCodigo, limit] of Object.entries(pendingDiscountChanges)) {
        const { data: existing } = await supabase
          .from('configuracion_descuentos')
          .select('id')
          .eq('rol_codigo', roleCodigo)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from('configuracion_descuentos')
            .update({ descuento_maximo_global: limit })
            .eq('rol_codigo', roleCodigo);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('configuracion_descuentos')
            .insert({ role: roleCodigo, rol_codigo: roleCodigo, descuento_maximo_global: limit });
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

  const toggleAllModulePermissions = (roleCodigo: string, modulo: string, enable: boolean) => {
    allPermissions.forEach((permiso) => {
      const key = `${roleCodigo}-${modulo}-${permiso}`;
      setPendingChanges((prev) => {
        const newMap = new Map(prev);
        newMap.set(key, enable);
        return newMap;
      });
    });
  };

  const getModulePermissionCount = (roleCodigo: string, modulo: string): number => {
    return allPermissions.filter((permiso) => hasPermission(roleCodigo, modulo, permiso)).length;
  };

  // CRUD Roles
  const handleSubmitRole = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!roleFormData.codigo || !roleFormData.nombre) {
      toast.error('Código y nombre son requeridos');
      return;
    }

    try {
      const dataToSave = {
        codigo: roleFormData.codigo.toLowerCase().replace(/\s+/g, '_'),
        nombre: roleFormData.nombre,
        descripcion: roleFormData.descripcion || null,
        color: roleFormData.color,
        orden: roleFormData.orden,
      };

      if (selectedRoleForEdit) {
        const { error } = await supabase
          .from('roles')
          .update(dataToSave)
          .eq('id', selectedRoleForEdit.id);
        if (error) throw error;
        toast.success('Rol actualizado');
      } else {
        const { error } = await supabase
          .from('roles')
          .insert([{ ...dataToSave, es_sistema: false }]);
        if (error) throw error;
        toast.success('Rol creado');
      }

      setRoleDialogOpen(false);
      resetRoleForm();
      await fetchData();
    } catch (error: any) {
      console.error('Error saving role:', error);
      if (error.code === '23505') {
        toast.error('Ya existe un rol con ese código');
      } else {
        toast.error('Error al guardar el rol');
      }
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRoleForEdit) return;
    
    if (selectedRoleForEdit.es_sistema) {
      toast.error('No se pueden eliminar roles del sistema');
      return;
    }

    try {
      // Delete permissions first
      await supabase
        .from('role_permissions')
        .delete()
        .eq('rol_codigo', selectedRoleForEdit.codigo);

      // Delete discount config
      await supabase
        .from('configuracion_descuentos')
        .delete()
        .eq('rol_codigo', selectedRoleForEdit.codigo);

      // Soft delete role
      const { error } = await supabase
        .from('roles')
        .update({ activo: false })
        .eq('id', selectedRoleForEdit.id);
      
      if (error) throw error;
      
      toast.success('Rol eliminado');
      setDeleteDialogOpen(false);
      setSelectedRoleForEdit(null);
      await fetchData();
    } catch (error) {
      console.error('Error deleting role:', error);
      toast.error('Error al eliminar el rol');
    }
  };

  const openEditRoleDialog = (role: Role) => {
    setSelectedRoleForEdit(role);
    setRoleFormData({
      codigo: role.codigo,
      nombre: role.nombre,
      descripcion: role.descripcion || '',
      color: role.color,
      orden: role.orden,
    });
    setRoleDialogOpen(true);
  };

  const resetRoleForm = () => {
    setSelectedRoleForEdit(null);
    setRoleFormData({
      codigo: '',
      nombre: '',
      descripcion: '',
      color: colorOptions[0].value,
      orden: roles.length,
    });
  };

  const getDiscountLimit = (roleCodigo: string): number => {
    if (pendingDiscountChanges[roleCodigo] !== undefined) {
      return pendingDiscountChanges[roleCodigo];
    }
    return discountLimits[roleCodigo] ?? 0;
  };

  const getUserCountByRole = async (roleCodigo: string): Promise<number> => {
    const { count } = await supabase
      .from('user_roles')
      .select('*', { count: 'exact', head: true })
      .eq('rol_codigo', roleCodigo);
    return count || 0;
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

  const nonAdminRoles = roles.filter(r => r.codigo !== 'admin');
  const currentRole = roles.find(r => r.codigo === selectedRole);

  return (
    <MainLayout>
      <PageHeader title="Roles y Permisos" description="Gestión de roles, permisos y descuentos">
        <div className="flex gap-2">
          {(pendingChanges.size > 0 || Object.keys(pendingDiscountChanges).length > 0) && (
            <Button onClick={handleSaveChanges} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Guardando...' : `Guardar (${pendingChanges.size + Object.keys(pendingDiscountChanges).length} cambios)`}
            </Button>
          )}
          <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={resetRoleForm}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Rol
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{selectedRoleForEdit ? 'Editar Rol' : 'Nuevo Rol'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmitRole} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Código *</Label>
                    <Input
                      value={roleFormData.codigo}
                      onChange={(e) => setRoleFormData({ ...roleFormData, codigo: e.target.value })}
                      placeholder="ej: supervisor"
                      disabled={selectedRoleForEdit?.es_sistema}
                      required
                    />
                    <p className="text-xs text-muted-foreground">Identificador único sin espacios</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre *</Label>
                    <Input
                      value={roleFormData.nombre}
                      onChange={(e) => setRoleFormData({ ...roleFormData, nombre: e.target.value })}
                      placeholder="ej: Supervisor"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descripción</Label>
                  <Textarea
                    value={roleFormData.descripcion}
                    onChange={(e) => setRoleFormData({ ...roleFormData, descripcion: e.target.value })}
                    placeholder="Descripción del rol..."
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <Select
                      value={roleFormData.color}
                      onValueChange={(v) => setRoleFormData({ ...roleFormData, color: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {colorOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex items-center gap-2">
                              <Badge className={opt.value}>{opt.label}</Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Orden</Label>
                    <Input
                      type="number"
                      value={roleFormData.orden}
                      onChange={(e) => setRoleFormData({ ...roleFormData, orden: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setRoleDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {selectedRoleForEdit ? 'Guardar' : 'Crear'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tabla de roles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Roles del Sistema
              </CardTitle>
              <CardDescription>
                Administra los roles disponibles. Los roles del sistema no pueden eliminarse.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rol</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-center">Tipo</TableHead>
                    <TableHead className="w-[100px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell>
                        <Badge className={role.color}>{role.nombre}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{role.codigo}</TableCell>
                      <TableCell className="text-muted-foreground">{role.descripcion || '-'}</TableCell>
                      <TableCell className="text-center">
                        {role.es_sistema ? (
                          <Badge variant="outline" className="gap-1">
                            <Lock className="h-3 w-3" />
                            Sistema
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Personalizado</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditRoleDialog(role)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          {!role.es_sistema && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { setSelectedRoleForEdit(role); setDeleteDialogOpen(true); }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Permisos por rol */}
          {nonAdminRoles.length > 0 && (
            <Tabs value={selectedRole} onValueChange={setSelectedRole}>
              <TabsList className="mb-6">
                {nonAdminRoles.map((role) => (
                  <TabsTrigger key={role.codigo} value={role.codigo} className="gap-2">
                    <Badge className={role.color}>{role.nombre}</Badge>
                  </TabsTrigger>
                ))}
              </TabsList>

              {nonAdminRoles.map((role) => (
                <TabsContent key={role.codigo} value={role.codigo}>
                  {/* Card de configuración del rol */}
                  <Card className="mb-6">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Badge className={role.color}>{role.nombre}</Badge>
                        {role.es_sistema && (
                          <Badge variant="outline" className="gap-1">
                            <Lock className="h-3 w-3" />
                            Sistema
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{role.descripcion}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Percent className="h-4 w-4 text-muted-foreground" />
                          <Label htmlFor={`discount-${role.codigo}`} className="text-sm font-medium">
                            Descuento máximo permitido:
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            id={`discount-${role.codigo}`}
                            type="text"
                            inputMode="decimal"
                            className="w-20 text-center"
                            value={getDiscountLimit(role.codigo).toString()}
                            onChange={(e) => handleDiscountLimitChange(role.codigo, e.target.value)}
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                        {pendingDiscountChanges[role.codigo] !== undefined && (
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
                                onClick={() => toggleAllModulePermissions(role.codigo, module.key, true)}
                              >
                                Todos
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => toggleAllModulePermissions(role.codigo, module.key, false)}
                              >
                                Ninguno
                              </Button>
                            </div>
                          </div>
                          <CardDescription>
                            {getModulePermissionCount(role.codigo, module.key)} de {allPermissions.length} permisos activos
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-2">
                            {allPermissions.map((permiso) => (
                              <div key={permiso} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`${role.codigo}-${module.key}-${permiso}`}
                                  checked={hasPermission(role.codigo, module.key, permiso)}
                                  onCheckedChange={() => togglePermission(role.codigo, module.key, permiso)}
                                />
                                <label
                                  htmlFor={`${role.codigo}-${module.key}-${permiso}`}
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

          {/* Admin info card */}
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Badge className={roles.find(r => r.codigo === 'admin')?.color || 'bg-red-100 text-red-800'}>
                  Administrador
                </Badge>
                <span className="text-muted-foreground font-normal">- Permisos completos</span>
              </CardTitle>
              <CardDescription>
                El rol de Administrador tiene acceso completo a todas las funciones del sistema. 
                Sus permisos no pueden ser modificados.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar rol?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el rol "{selectedRoleForEdit?.nombre}" y todos sus permisos asociados.
              Los usuarios con este rol perderán acceso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRole} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
