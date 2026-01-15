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

interface Marca {
  id: string;
  nombre: string;
  activo: boolean;
  created_at: string;
}

const Marcas = () => {
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMarca, setSelectedMarca] = useState<Marca | null>(null);
  const [formData, setFormData] = useState({ nombre: "", activo: true });

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("marcas")
      .select("*")
      .order("nombre");

    if (error) {
      toast.error("Error al cargar marcas");
    } else {
      setMarcas(data || []);
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

    if (selectedMarca) {
      const { error } = await supabase
        .from("marcas")
        .update({ nombre: formData.nombre, activo: formData.activo })
        .eq("id", selectedMarca.id);

      if (error) {
        toast.error("Error al actualizar marca");
      } else {
        toast.success("Marca actualizada");
        fetchData();
        setDialogOpen(false);
        resetForm();
      }
    } else {
      const { error } = await supabase
        .from("marcas")
        .insert([{ nombre: formData.nombre, activo: formData.activo }]);

      if (error) {
        if (error.code === "23505") {
          toast.error("Ya existe una marca con ese nombre");
        } else {
          toast.error("Error al crear marca");
        }
      } else {
        toast.success("Marca creada");
        fetchData();
        setDialogOpen(false);
        resetForm();
      }
    }
  };

  const handleDelete = async () => {
    if (!selectedMarca) return;

    const { error } = await supabase
      .from("marcas")
      .delete()
      .eq("id", selectedMarca.id);

    if (error) {
      if (error.code === "23503") {
        toast.error("No se puede eliminar: hay productos asociados a esta marca");
      } else {
        toast.error("Error al eliminar marca");
      }
    } else {
      toast.success("Marca eliminada");
      fetchData();
    }
    setDeleteDialogOpen(false);
    setSelectedMarca(null);
  };

  const openEditDialog = (marca: Marca) => {
    setSelectedMarca(marca);
    setFormData({ nombre: marca.nombre, activo: marca.activo });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ nombre: "", activo: true });
    setSelectedMarca(null);
  };

  const columns = [
    { key: "nombre" as keyof Marca, header: "Nombre" },
    {
      key: "activo" as keyof Marca,
      header: "Estado",
      render: (marca: Marca) => (
        <StatusBadge status={marca.activo} />
      ),
    },
    {
      key: "created_at" as keyof Marca,
      header: "Fecha Creación",
      render: (marca: Marca) =>
        new Date(marca.created_at).toLocaleDateString("es-AR"),
    },
    {
      key: "id" as keyof Marca,
      header: "Acciones",
      render: (marca: Marca) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => openEditDialog(marca)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedMarca(marca);
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
      <PageHeader title="Marcas" description="Gestión de marcas de productos">
        <Button
          onClick={() => {
            resetForm();
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Nueva Marca
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={marcas}
        loading={loading}
        searchPlaceholder="Buscar marca..."
        searchKeys={["nombre"]}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedMarca ? "Editar Marca" : "Nueva Marca"}
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
                placeholder="Nombre de la marca"
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
              {selectedMarca ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar marca?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará la marca "{selectedMarca?.nombre}".
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

export default Marcas;
