import { type LucideIcon } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Pantalla } from "./ayudaContent";

interface PantallaAccordionProps {
  modulo: string;
  icon: LucideIcon;
  pantallas: Pantalla[];
}

export function PantallaAccordion({ modulo, icon: Icon, pantallas }: PantallaAccordionProps) {
  const scrollToFlujo = (flujoId: string) => {
    const el = document.getElementById(flujoId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-5 w-5 text-primary" />
          {modulo}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          {pantallas.map((p) => (
            <AccordionItem key={p.id} value={p.id} id={p.id} className="scroll-mt-24">
              <AccordionTrigger className="text-left">
                <div className="flex flex-col items-start">
                  <span className="font-semibold">{p.nombre}</span>
                  <span className="text-xs text-muted-foreground font-mono">{p.ruta}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Qué es
                  </p>
                  <p className="text-sm text-foreground mt-1">{p.queEs}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Para qué se usa
                  </p>
                  <p className="text-sm text-foreground mt-1">{p.paraQue}</p>
                </div>
                {p.flujos.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Participa en
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {p.flujos.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => scrollToFlujo(f.id)}
                        >
                          <Badge variant="outline" className="cursor-pointer hover:bg-accent">
                            ← {f.label}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}