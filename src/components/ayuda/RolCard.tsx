import { type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface RolCardProps {
  nombre: string;
  descripcion: string;
  icon: LucideIcon;
}

export function RolCard({ nombre, descripcion, icon: Icon }: RolCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground flex-shrink-0">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{nombre}</h3>
            <p className="text-sm text-muted-foreground mt-1">{descripcion}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}