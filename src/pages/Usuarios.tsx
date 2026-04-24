import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Shield, UserX, UserCheck, Pencil, Trash2, KeyRound, Link2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

interface Profile {
  id: string;
  nombre: string;
  email: string;
  estado: boolean;
  sucursal: string | null;
}

interface UserRole {
  role: string;
}

interface UserWithRoles extends Profile {
  roles: UserRole[];
  empleado_id?: string | null;
  empleado_nombre?: string | null;
}

interface Empleado {
  id: string;
  nombre: string;
  user_id: string | null;
}

interface RoleDefinition {
  codigo: string;
  nombre: string;
  color: string;
}

export default function Usuarios() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  
  const [usuarios, setUsuarios] = useState<UserWithRoles[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [allRoles, setAllRoles] = useState<RoleDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [rolesDialogOpen, setRolesDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [linkEmpleadoDialogOpen, setLinkEmpleadoDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedEmpleadoId, setSelectedEmpleadoId] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    sucursal: '',
    empleado_id: '',
  });
  const [editFormData, setEditFormData] = useState({
    nombre: '',
    sucursal: '',
  });

  useEffect(() => {
    fetchUsuarios();
    fetchEmpleados();
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    const { data, error } = await supabase
      .from('roles')
      .select('codigo, nombre, color')
      .eq('activo', true)
      .order('orden');
    if (error) {
      console.error('Error fetching roles:', error);
      return;
    }
    setAllRoles((data || []) as RoleDefinition[]);
  };

  const getRoleLabel = (codigo: string) =>
    allRoles.find((r) => r.codigo === codigo)?.nombre || codigo;
  const getRoleColor = (codigo: string) =>
    allRoles.find((r) => r.codigo === codigo)?.color ||
    'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('nombre');

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Fetch empleados linked to users
      const { data: empleadosData } = await supabase
        .from('empleados')
        .select('id, nombre, user_id')
        .not('user_id', 'is', null);

      const usersWithRoles: UserWithRoles[] = (profiles || []).map((profile) => {
        const empleadoVinculado = empleadosData?.find(e => e.user_id === profile.id);
        return {
          ...profile,
          roles: (roles || [])
            .filter((r) => r.user_id === profile.id)
            .map((r) => ({ role: r.role })),
          empleado_id: empleadoVinculado?.id || null,
          empleado_nombre: empleadoVinculado?.nombre || null,
        };
      });

      setUsuarios(usersWithRoles);
    } catch (error) {
      console.error('Error fetching usuarios:', error);
      toast.error('Error al cargar los usuarios');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmpleados = async () => {
    try {
      const { data, error } = await supabase
        .from('empleados')
        .select('id, nombre, user_id')
        .eq('activo', true)
        .order('nombre');

      if (error) throw error;
      setEmpleados(data || []);
    } catch (error) {
      console.error('Error fetching empleados:', error);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { nombre: formData.nombre }
        }
      });

      if (error) throw error;

      if (data.user) {
        // Update profile with sucursal
        await supabase
          .from('profiles')
          .update({ sucursal: formData.sucursal || null })
          .eq('id', data.user.id);

        // Link to empleado if selected
        if (formData.empleado_id && formData.empleado_id !== '__none__') {
          await supabase
            .from('empleados')
            .update({ user_id: data.user.id })
            .eq('id', formData.empleado_id);
        }
      }

      toast.success('Usuario creado correctamente');
      setDialogOpen(false);
      resetForm();
      fetchUsuarios();
      fetchEmpleados();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Error al crear el usuario');
    }
  };

  const handleToggleStatus = async (user: UserWithRoles) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ estado: !user.estado })
        .eq('id', user.id);

      if (error) throw error;
      toast.success(`Usuario ${user.estado ? 'desactivado' : 'activado'} correctamente`);
      fetchUsuarios();
    } catch (error) {
      console.error('Error updating user status:', error);
      toast.error('Error al actualizar el estado del usuario');
    }
  };

  const openRolesDialog = (user: UserWithRoles) => {
    setSelectedUser(user);
    setSelectedRoles(user.roles.map((r) => r.role));
    setRolesDialogOpen(true);
  };

  const openEditDialog = (user: UserWithRoles) => {
    setSelectedUser(user);
    setEditFormData({
      nombre: user.nombre,
      sucursal: user.sucursal || '',
    });
    setEditDialogOpen(true);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          nombre: editFormData.nombre,
          sucursal: editFormData.sucursal || null,
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast.success('Usuario actualizado correctamente');
      setEditDialogOpen(false);
      fetchUsuarios();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error(error.message || 'Error al actualizar el usuario');
    }
  };

  const openDeleteDialog = (user: UserWithRoles) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const openPasswordDialog = (user: UserWithRoles) => {
    setSelectedUser(user);
    setNewPassword('');
    setPasswordDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setActionLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session?.access_token}`,
          },
          body: JSON.stringify({
            action: 'delete',
            userId: selectedUser.id,
          }),
        }
      );

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Error al eliminar usuario');
      }

      toast.success('Usuario eliminado correctamente');
      setDeleteDialogOpen(false);
      fetchUsuarios();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Error al eliminar el usuario');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newPassword) return;

    setActionLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session?.access_token}`,
          },
          body: JSON.stringify({
            action: 'reset-password',
            userId: selectedUser.id,
            newPassword,
          }),
        }
      );

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Error al restablecer contraseña');
      }

      toast.success('Contraseña restablecida correctamente');
      setPasswordDialogOpen(false);
      setNewPassword('');
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast.error(error.message || 'Error al restablecer la contraseña');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveRoles = async () => {
    if (!selectedUser) return;

    try {
      // Remove all existing roles
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', selectedUser.id);

      // Add new roles
      if (selectedRoles.length > 0) {
        const { error } = await supabase
          .from('user_roles')
          .insert(
            selectedRoles.map((role) => ({
              user_id: selectedUser.id,
              role: role as any,
            }))
          );

        if (error) throw error;
      }

      toast.success('Roles actualizados correctamente');
      setRolesDialogOpen(false);
      
      // Also update empleados table with vendedor/chofer link if needed
      if (selectedUser && selectedEmpleadoId) {
        // Clear previous user_id from any empleado
        await supabase
          .from('empleados')
          .update({ user_id: null })
          .eq('user_id', selectedUser.id);
        
        // Set new link
        await supabase
          .from('empleados')
          .update({ user_id: selectedUser.id })
          .eq('id', selectedEmpleadoId);
      }
      fetchUsuarios();
    } catch (error) {
      console.error('Error updating roles:', error);
      toast.error('Error al actualizar los roles');
    }
  };

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role)
        ? prev.filter((r) => r !== role)
        : [...prev, role]
    );
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      email: '',
      password: '',
      sucursal: '',
      empleado_id: '',
    });
  };

  const openLinkEmpleadoDialog = (user: UserWithRoles) => {
    setSelectedUser(user);
    setSelectedEmpleadoId(user.empleado_id || '__none__');
    setLinkEmpleadoDialogOpen(true);
  };

  const handleLinkEmpleado = async () => {
    if (!selectedUser) return;

    try {
      // Clear previous link
      await supabase
        .from('empleados')
        .update({ user_id: null })
        .eq('user_id', selectedUser.id);

      // Set new link if selected (not the placeholder)
      if (selectedEmpleadoId && selectedEmpleadoId !== '__none__') {
        const { error } = await supabase
          .from('empleados')
          .update({ user_id: selectedUser.id })
          .eq('id', selectedEmpleadoId);

        if (error) throw error;
      }

      toast.success('Empleado vinculado correctamente');
      setLinkEmpleadoDialogOpen(false);
      fetchUsuarios();
      fetchEmpleados();
    } catch (error) {
      console.error('Error linking empleado:', error);
      toast.error('Error al vincular empleado');
    }
  };

  // Get available empleados (not linked or linked to current user)
  const getAvailableEmpleados = (currentUserId?: string) => {
    return empleados.filter(e => !e.user_id || e.user_id === currentUserId);
  };

  const columns = [
    { key: 'nombre', header: 'Nombre' },
    { key: 'email', header: 'Email' },
    {
      key: 'roles',
      header: 'Roles',
      render: (item: UserWithRoles) => (
        <div className="flex flex-wrap gap-1">
          {item.roles.length > 0 ? (
            item.roles.map((r, idx) => (
              <Badge key={idx} className={getRoleColor(r.role)}>
                {getRoleLabel(r.role)}
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground text-sm">Sin roles</span>
          )}
        </div>
      ),
    },
    {
      key: 'empleado',
      header: 'Empleado Vinculado',
      render: (item: UserWithRoles) => (
        <span className={item.empleado_nombre ? 'font-medium' : 'text-muted-foreground text-sm'}>
          {item.empleado_nombre || 'Sin vincular'}
        </span>
      ),
    },
    { 
      key: 'sucursal', 
      header: 'Sucursal', 
      render: (item: UserWithRoles) => item.sucursal || '-' 
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (item: UserWithRoles) => <StatusBadge status={item.estado} />,
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (item: UserWithRoles) => (
        <div className="flex items-center gap-1">
          {isAdmin && (
            <>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => openEditDialog(item)}
                title="Editar usuario"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => openRolesDialog(item)}
                title="Gestionar roles"
              >
                <Shield className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => openLinkEmpleadoDialog(item)}
                title="Vincular empleado"
              >
                <Link2 className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => openPasswordDialog(item)}
                title="Restablecer contraseña"
              >
                <KeyRound className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleToggleStatus(item)}
                title={item.estado ? 'Desactivar usuario' : 'Activar usuario'}
              >
                {item.estado ? (
                  <UserX className="h-4 w-4 text-destructive" />
                ) : (
                  <UserCheck className="h-4 w-4 text-primary" />
                )}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => openDeleteDialog(item)}
                title="Eliminar usuario"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <PageHeader title="Usuarios" description="Gestión de usuarios del sistema">
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Usuario
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo Usuario</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre *</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) =>
                      setFormData({ ...formData, nombre: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    required
                    minLength={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sucursal">Sucursal</Label>
                  <Input
                    id="sucursal"
                    value={formData.sucursal}
                    onChange={(e) =>
                      setFormData({ ...formData, sucursal: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="empleado">Vincular a Empleado</Label>
                  <Select
                    value={formData.empleado_id || '__none__'}
                    onValueChange={(value) =>
                      setFormData({ ...formData, empleado_id: value === '__none__' ? '' : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin vincular (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin vincular</SelectItem>
                      {getAvailableEmpleados().map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Vincular a un empleado permite asignar roles de chofer o vendedor
                  </p>
                </div>

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Crear Usuario</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </PageHeader>

      <DataTable
        data={usuarios}
        columns={columns}
        searchPlaceholder="Buscar usuarios..."
        searchKeys={['nombre', 'email', 'sucursal']}
        loading={loading}
      />

      {/* Dialog para gestionar roles */}
      <Dialog open={rolesDialogOpen} onOpenChange={setRolesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gestionar Roles - {selectedUser?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecciona los roles que deseas asignar a este usuario:
            </p>
            <div className="space-y-3">
              {allRoles.map((role) => (
                <div key={role.codigo} className="flex items-center space-x-3">
                  <Checkbox
                    id={`role-${role.codigo}`}
                    checked={selectedRoles.includes(role.codigo)}
                    onCheckedChange={() => toggleRole(role.codigo)}
                  />
                  <Label htmlFor={`role-${role.codigo}`} className="flex items-center gap-2">
                    <Badge className={role.color}>{role.nombre}</Badge>
                  </Label>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setRolesDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveRoles}>Guardar Roles</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para editar usuario */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nombre">Nombre *</Label>
              <Input
                id="edit-nombre"
                value={editFormData.nombre}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, nombre: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={selectedUser?.email || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                El email no puede ser modificado
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-sucursal">Sucursal</Label>
              <Input
                id="edit-sucursal"
                value={editFormData.sucursal}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, sucursal: e.target.value })
                }
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar Cambios</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog para restablecer contraseña */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restablecer Contraseña</DialogTitle>
            <DialogDescription>
              Ingresa la nueva contraseña para {selectedUser?.nombre}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nueva Contraseña *</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setPasswordDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={actionLoading}>
                {actionLoading ? 'Guardando...' : 'Guardar Contraseña'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* AlertDialog para confirmar eliminación */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente al usuario{' '}
              <strong>{selectedUser?.nombre}</strong> ({selectedUser?.email}) y todos sus datos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog para vincular empleado */}
      <Dialog open={linkEmpleadoDialogOpen} onOpenChange={setLinkEmpleadoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular Empleado - {selectedUser?.nombre}</DialogTitle>
            <DialogDescription>
              Selecciona el empleado que corresponde a este usuario
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Empleado</Label>
              <Select
                value={selectedEmpleadoId}
                onValueChange={setSelectedEmpleadoId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar empleado..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin vincular</SelectItem>
                  {getAvailableEmpleados(selectedUser?.id).map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Al vincular un empleado, cuando este usuario inicie sesión podrá ver sus datos según el rol asignado (chofer/vendedor)
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setLinkEmpleadoDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleLinkEmpleado}>Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
