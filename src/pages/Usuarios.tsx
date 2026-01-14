import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Edit2, UserPlus, Shield } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface Profile {
  id: string;
  nombre: string;
  email: string;
  estado: boolean;
  sucursal: string | null;
  created_at: string;
}

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

interface UserWithRole extends Profile {
  roles: AppRole[];
}

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador',
  encargado: 'Encargado',
  cajero: 'Cajero',
  vendedor: 'Vendedor',
  deposito: 'Depósito',
};

const roleColors: Record<AppRole, string> = {
  admin: 'bg-red-500/10 text-red-500 border-red-500/20',
  encargado: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  cajero: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  vendedor: 'bg-green-500/10 text-green-500 border-green-500/20',
  deposito: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
};

export default function Usuarios() {
  const { hasRole } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    estado: true,
    sucursal: '',
  });
  const [selectedRole, setSelectedRole] = useState<AppRole>('vendedor');

  const isAdmin = hasRole('admin');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('*').order('nombre'),
        supabase.from('user_roles').select('*'),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const usersWithRoles: UserWithRole[] = (profilesRes.data || []).map((profile) => ({
        ...profile,
        roles: (rolesRes.data || [])
          .filter((r) => r.user_id === profile.id)
          .map((r) => r.role),
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Error al cargar los usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password || !formData.nombre) {
      toast.error('Complete todos los campos requeridos');
      return;
    }

    try {
      // Create user in auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            nombre: formData.nombre,
          },
        },
      });

      if (authError) throw authError;

      // Update profile with additional data
      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            sucursal: formData.sucursal || null,
            estado: formData.estado,
          })
          .eq('id', authData.user.id);

        if (profileError) throw profileError;

        // Assign default role
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert([{ user_id: authData.user.id, role: selectedRole }]);

        if (roleError) throw roleError;
      }

      toast.success('Usuario creado correctamente');
      setDialogOpen(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      if (error.message?.includes('already registered')) {
        toast.error('El email ya está registrado');
      } else {
        toast.error('Error al crear el usuario');
      }
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          nombre: formData.nombre,
          sucursal: formData.sucursal || null,
          estado: formData.estado,
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast.success('Usuario actualizado correctamente');
      setDialogOpen(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Error al actualizar el usuario');
    }
  };

  const handleAssignRole = async () => {
    if (!selectedUser) return;

    try {
      // Check if user already has this role
      if (selectedUser.roles.includes(selectedRole)) {
        toast.error('El usuario ya tiene este rol');
        return;
      }

      const { error } = await supabase
        .from('user_roles')
        .insert([{ user_id: selectedUser.id, role: selectedRole }]);

      if (error) throw error;

      toast.success('Rol asignado correctamente');
      setRoleDialogOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Error assigning role:', error);
      toast.error('Error al asignar el rol');
    }
  };

  const handleRemoveRole = async (userId: string, role: AppRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

      if (error) throw error;

      toast.success('Rol removido correctamente');
      fetchUsers();
    } catch (error) {
      console.error('Error removing role:', error);
      toast.error('Error al remover el rol');
    }
  };

  const openEditDialog = (user: UserWithRole) => {
    setSelectedUser(user);
    setFormData({
      nombre: user.nombre,
      email: user.email,
      password: '',
      estado: user.estado,
      sucursal: user.sucursal || '',
    });
    setDialogOpen(true);
  };

  const openRoleDialog = (user: UserWithRole) => {
    setSelectedUser(user);
    setSelectedRole('vendedor');
    setRoleDialogOpen(true);
  };

  const resetForm = () => {
    setSelectedUser(null);
    setFormData({
      nombre: '',
      email: '',
      password: '',
      estado: true,
      sucursal: '',
    });
    setSelectedRole('vendedor');
  };

  const columns = [
    { key: 'nombre', header: 'Nombre' },
    { key: 'email', header: 'Email' },
    { key: 'sucursal', header: 'Sucursal', render: (item: UserWithRole) => item.sucursal || '-' },
    {
      key: 'roles',
      header: 'Roles',
      render: (item: UserWithRole) => (
        <div className="flex flex-wrap gap-1">
          {item.roles.length === 0 ? (
            <span className="text-muted-foreground text-sm">Sin rol</span>
          ) : (
            item.roles.map((role) => (
              <Badge
                key={role}
                variant="outline"
                className={`${roleColors[role]} cursor-pointer`}
                onClick={() => isAdmin && handleRemoveRole(item.id, role)}
              >
                {roleLabels[role]}
                {isAdmin && <span className="ml-1">×</span>}
              </Badge>
            ))
          )}
        </div>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (item: UserWithRole) => <StatusBadge status={item.estado} />,
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (item: UserWithRole) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
            <Edit2 className="h-4 w-4" />
          </Button>
          {isAdmin && (
            <Button variant="ghost" size="icon" onClick={() => openRoleDialog(item)}>
              <Shield className="h-4 w-4" />
            </Button>
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
                <UserPlus className="mr-2 h-4 w-4" />
                Nuevo Usuario
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {selectedUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={selectedUser ? handleUpdateUser : handleCreateUser} className="space-y-4">
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

                {!selectedUser && (
                  <>
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
                      <Label htmlFor="role">Rol inicial</Label>
                      <Select
                        value={selectedRole}
                        onValueChange={(value) => setSelectedRole(value as AppRole)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(roleLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

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

                <div className="flex items-center gap-2">
                  <Switch
                    id="estado"
                    checked={formData.estado}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, estado: checked })
                    }
                  />
                  <Label htmlFor="estado">Usuario activo</Label>
                </div>

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {selectedUser ? 'Guardar Cambios' : 'Crear Usuario'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </PageHeader>

      <DataTable
        data={users}
        columns={columns}
        searchPlaceholder="Buscar usuarios..."
        searchKeys={['nombre', 'email', 'sucursal']}
        loading={loading}
      />

      {/* Assign Role Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar Rol a {selectedUser?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Roles actuales</Label>
              <div className="flex flex-wrap gap-2">
                {selectedUser?.roles.length === 0 ? (
                  <span className="text-muted-foreground text-sm">Sin roles asignados</span>
                ) : (
                  selectedUser?.roles.map((role) => (
                    <Badge key={role} variant="outline" className={roleColors[role]}>
                      {roleLabels[role]}
                    </Badge>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newRole">Nuevo rol</Label>
              <Select
                value={selectedRole}
                onValueChange={(value) => setSelectedRole(value as AppRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <SelectItem 
                      key={value} 
                      value={value}
                      disabled={selectedUser?.roles.includes(value as AppRole)}
                    >
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setRoleDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAssignRole}>Asignar Rol</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
