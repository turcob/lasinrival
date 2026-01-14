import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Pencil } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Shield, UserX, UserCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  role: 'admin' | 'encargado' | 'cajero' | 'vendedor' | 'deposito';
}

interface UserWithRoles extends Profile {
  roles: UserRole[];
}

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  encargado: 'Encargado',
  cajero: 'Cajero',
  vendedor: 'Vendedor',
  deposito: 'Depósito',
};

const roleColors: Record<string, string> = {
  admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  encargado: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  cajero: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  vendedor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  deposito: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

const allRoles = ['admin', 'encargado', 'cajero', 'vendedor', 'deposito'] as const;

export default function Usuarios() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  
  const [usuarios, setUsuarios] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [rolesDialogOpen, setRolesDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    sucursal: '',
  });
  const [editFormData, setEditFormData] = useState({
    nombre: '',
    sucursal: '',
  });

  useEffect(() => {
    fetchUsuarios();
  }, []);

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

      const usersWithRoles: UserWithRoles[] = (profiles || []).map((profile) => ({
        ...profile,
        roles: (roles || [])
          .filter((r) => r.user_id === profile.id)
          .map((r) => ({ role: r.role })),
      }));

      setUsuarios(usersWithRoles);
    } catch (error) {
      console.error('Error fetching usuarios:', error);
      toast.error('Error al cargar los usuarios');
    } finally {
      setLoading(false);
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
        await supabase
          .from('profiles')
          .update({ sucursal: formData.sucursal || null })
          .eq('id', data.user.id);
      }

      toast.success('Usuario creado correctamente');
      setDialogOpen(false);
      resetForm();
      fetchUsuarios();
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
              role: role as UserRole['role'],
            }))
          );

        if (error) throw error;
      }

      toast.success('Roles actualizados correctamente');
      setRolesDialogOpen(false);
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
    });
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
              <Badge key={idx} className={roleColors[r.role]}>
                {roleLabels[r.role]}
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground text-sm">Sin roles</span>
          )}
        </div>
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
        <div className="flex items-center gap-2">
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
                onClick={() => handleToggleStatus(item)}
                title={item.estado ? 'Desactivar usuario' : 'Activar usuario'}
              >
                {item.estado ? (
                  <UserX className="h-4 w-4 text-destructive" />
                ) : (
                  <UserCheck className="h-4 w-4 text-green-600" />
                )}
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
                <div key={role} className="flex items-center space-x-3">
                  <Checkbox
                    id={`role-${role}`}
                    checked={selectedRoles.includes(role)}
                    onCheckedChange={() => toggleRole(role)}
                  />
                  <Label htmlFor={`role-${role}`} className="flex items-center gap-2">
                    <Badge className={roleColors[role]}>{roleLabels[role]}</Badge>
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
    </MainLayout>
  );
}
