import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TipoProducto {
  id: string;
  nombre: string;
  activo: boolean;
  created_at: string;
}

const TiposProducto = () => {
  const [tipos, setTipos] = useState<TipoProducto[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTipo, setSelectedTipo] = useState<TipoProducto | null>(null);
  const [formData, setFormData] = useState({ nombre: "", activo: true });

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tipos_producto")
      .select("*")
      .order("nombre");

    if (error) {
      toast.error("Error al cargar tipos de producto");
    } else {
      setTipos(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async () => {
    if (!formData.nombre.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    if (selectedTipo) {
      const { error } = await supabase
        .from("tipos_producto")
        .update({ nombre: formData.nombre, activo: formData.activo })
        .eq("id", selectedTipo.id);

      if (error) {
        toast.error("Error al actualizar tipo de producto");
      } else {
        toast.success("Tipo de producto actualizado");
        fetchData();
        setDialogOpen(false);
        resetForm();
      }
    } else {
      const { error } = await supabase
        .from("tipos_producto")
        .insert([{ nombre: formData.nombre, activo: formData.activo }]);

      if (error) {
        if (error.code === "23505") {
          toast.error("Ya existe un tipo de producto con ese nombre");
        } else {
          toast.error("Error al crear tipo de producto");
        }
      } else {
        toast.success("Tipo de producto creado");
        fetchData();
        setDialogOpen(false);
        resetForm();
      }
    }
  };

  const handleDelete = async () => {
    if (!selectedTipo) return;

    const { error } = await supabase
      .from("tipos_producto")
      .delete()
      .eq("id", selectedTipo.id);

    if (error) {
      if (error.code === "23503") {
        toast.error("No se puede eliminar: hay productos asociados a este tipo");
      } else {
        toast.error("Error al eliminar tipo de producto");
      }
    } else {
      toast.success("Tipo de producto eliminado");
      fetchData();
    }
    setDeleteDialogOpen(false);
    setSelectedTipo(null);
  };

  const openEditDialog = (tipo: TipoProducto) => {
    setSelectedTipo(tipo);
    setFormData({ nombre: tipo.nombre, activo: tipo.activo });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ nombre: "", activo: true });
    setSelectedTipo(null);
  };

  const columns = [
    { key: "nombre" as keyof TipoProducto, header: "Nombre" },
    {
      key: "activo" as keyof TipoProducto,
      header: "Estado",
      render: (tipo: TipoProducto) => (
        <StatusBadge status={tipo.activo} />
      ),
    },
    {
      key: "created_at" as keyof TipoProducto,
      header: "Fecha Creación",
      render: (tipo: TipoProducto) =>
        new Date(tipo.created_at).toLocaleDateString("es-AR"),
    },
    {
      key: "id" as keyof TipoProducto,
      header: "Acciones",
      render: (tipo: TipoProducto) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => openEditDialog(tipo)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedTipo(tipo);
              setDeleteDialogOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <PageHeader title="Tipos de Producto" description="Gestión de tipos/categorías de productos">
        <Button
          onClick={() => {
            resetForm();
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Nuevo Tipo
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={tipos}
        loading={loading}
        searchPlaceholder="Buscar tipo..."
        searchKeys={["nombre"]}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedTipo ? "Editar Tipo de Producto" : "Nuevo Tipo de Producto"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) =>
                  setFormData({ ...formData, nombre: e.target.value })
                }
                placeholder="Ej: Quesos, Fiambres, Lácteos..."
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="activo"
                checked={formData.activo}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, activo: checked })
                }
              />
              <Label htmlFor="activo">Activo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>
              {selectedTipo ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tipo de producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará el tipo "{selectedTipo?.nombre}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default TiposProducto;
