import { type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PasoFlujo } from "./ayudaContent";

interface FlujoStepperProps {
  id: string;
  titulo: string;
  resumen: string;
  icon: LucideIcon;
  pasos: PasoFlujo[];
}

export function FlujoStepper({ id, titulo, resumen, icon: Icon, pasos }: FlujoStepperProps) {
  const scrollToPantalla = (pantallaId?: string) => {
    if (!pantallaId) return;
    const el = document.getElementById(pantallaId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Card id={id} className="scroll-mt-24">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">{titulo}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{resumen}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-6 border-l-2 border-border pl-6 ml-4">
          {pasos.map((paso, idx) => {
            const StepIcon = paso.icon;
            return (
              <li key={idx} className="relative">
                <span className="absolute -left-[35px] flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold ring-4 ring-background">
                  {idx + 1}
                </span>
                <div className="flex items-start gap-3">
                  <StepIcon className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-foreground">
                      {paso.titulo}
                    </h4>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {paso.descripcion}
                    </p>
                    {paso.pantallaId && (
                      <button
                        type="button"
                        onClick={() => scrollToPantalla(paso.pantallaId)}
                        className="mt-2 inline-block"
                      >
                        <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                          Ver pantalla →
                        </Badge>
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}