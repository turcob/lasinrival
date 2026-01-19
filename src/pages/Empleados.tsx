import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Edit2, Trash2, Wallet, Calculator } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { EmpleadoFormDialog } from '@/components/empleados/EmpleadoFormDialog';
import { CuentaCorrienteDialog } from '@/components/empleados/CuentaCorrienteDialog';
import { LiquidacionSection } from '@/components/empleados/LiquidacionSection';

interface Empleado {
  id: string;
  nombre: string;
  dni: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  fecha_ingreso: string | null;
  sueldo_base: number;
  cargo: string | null;
  estado_civil: string | null;
  cbu_cuenta: string | null;
  activo: boolean;
  created_at: string;
}

interface EmpleadoConSaldo extends Empleado {
  saldo_actual?: number;
  total_comisiones?: number;
}

export default function Empleados() {
  const { user } = useAuth();
  const [empleados, setEmpleados] = useState<EmpleadoConSaldo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cuentaDialogOpen, setCuentaDialogOpen] = useState(false);
  const [selectedEmpleado, setSelectedEmpleado] = useState<Empleado | null>(null);

  useEffect(() => {
    fetchEmpleados();
  }, []);

  const fetchEmpleados = async () => {
    setLoading(true);
    try {
      // Fetch empleados
      const { data: empleadosData, error: empleadosError } = await supabase
        .from('empleados')
        .select('*')
        .order('nombre');

      if (empleadosError) throw empleadosError;

      // Fetch saldos from view
      const { data: saldosData } = await supabase
        .from('empleado_saldos')
        .select('*');

      // Merge saldos with empleados
      const empleadosConSaldo = (empleadosData || []).map(emp => {
        const saldo = saldosData?.find(s => s.empleado_id === emp.id);
        return {
          ...emp,
          saldo_actual: saldo?.saldo_actual || 0,
          total_comisiones: saldo?.total_comisiones || 0,
        };
      });

      setEmpleados(empleadosConSaldo);
    } catch (error) {
      console.error('Error fetching empleados:', error);
      toast.error('Error al cargar los empleados');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedEmpleado) return;

    try {
      const { error } = await supabase
        .from('empleados')
        .delete()
        .eq('id', selectedEmpleado.id);

      if (error) throw error;
      toast.success('Empleado eliminado correctamente');
      setDeleteDialogOpen(false);
      setSelectedEmpleado(null);
      fetchEmpleados();
    } catch (error) {
      console.error('Error deleting empleado:', error);
      toast.error('Error al eliminar el empleado');
    }
  };

  const openEditDialog = (empleado: Empleado) => {
    setSelectedEmpleado(empleado);
    setDialogOpen(true);
  };

  const openCuentaDialog = (empleado: Empleado) => {
    setSelectedEmpleado(empleado);
    setCuentaDialogOpen(true);
  };

  const columns = [
    { key: 'nombre', header: 'Nombre Completo' },
    { key: 'dni', header: 'DNI', render: (item: EmpleadoConSaldo) => item.dni || '-' },
    { key: 'cargo', header: 'Cargo', render: (item: EmpleadoConSaldo) => item.cargo || '-' },
    { 
      key: 'sueldo_base', 
      header: 'Sueldo Base', 
      render: (item: EmpleadoConSaldo) => `$${Number(item.sueldo_base).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` 
    },
    { 
      key: 'saldo_actual', 
      header: 'Saldo CC', 
      render: (item: EmpleadoConSaldo) => {
        const saldo = Number(item.saldo_actual) || 0;
        return (
          <span className={saldo > 0 ? 'text-destructive font-medium' : saldo < 0 ? 'text-green-600 font-medium' : ''}>
            ${saldo.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </span>
        );
      }
    },
    {
      key: 'activo',
      header: 'Estado',
      render: (item: EmpleadoConSaldo) => <StatusBadge status={item.activo} />,
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (item: EmpleadoConSaldo) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => openCuentaDialog(item)} title="Ver cuenta corriente">
            <Wallet className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} title="Editar">
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedEmpleado(item);
              setDeleteDialogOpen(true);
            }}
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <PageHeader title="Empleados" description="Gestión de empleados y cuenta corriente">
        <Button onClick={() => { setSelectedEmpleado(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Empleado
        </Button>
      </PageHeader>

      <Tabs defaultValue="lista" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="lista">Lista de Empleados</TabsTrigger>
          <TabsTrigger value="liquidaciones">
            <Calculator className="h-4 w-4 mr-2" />
            Liquidaciones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista">
          <DataTable
            data={empleados}
            columns={columns}
            searchPlaceholder="Buscar empleados..."
            searchKeys={['nombre', 'dni', 'cargo', 'email']}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="liquidaciones">
          <LiquidacionSection empleados={empleados} onRefresh={fetchEmpleados} />
        </TabsContent>
      </Tabs>

      {/* Form Dialog */}
      <EmpleadoFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        empleado={selectedEmpleado}
        onSuccess={() => {
          setDialogOpen(false);
          setSelectedEmpleado(null);
          fetchEmpleados();
        }}
      />

      {/* Cuenta Corriente Dialog */}
      {selectedEmpleado && (
        <CuentaCorrienteDialog
          open={cuentaDialogOpen}
          onOpenChange={setCuentaDialogOpen}
          empleado={selectedEmpleado}
          onMovimientoRegistrado={fetchEmpleados}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar empleado?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el empleado
              "{selectedEmpleado?.nombre}" y todos sus movimientos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
