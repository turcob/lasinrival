import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { BookOpen, Info } from "lucide-react";
import {
  roles,
  flujos,
  modulos,
  secciones,
} from "@/components/ayuda/ayudaContent";
import { FlujoStepper } from "@/components/ayuda/FlujoStepper";
import { RolCard } from "@/components/ayuda/RolCard";
import { PantallaAccordion } from "@/components/ayuda/PantallaAccordion";

export default function Ayuda() {
  const [seccionActiva, setSeccionActiva] = useState("introduccion");

  const scrollTo = (id: string) => {
    setSeccionActiva(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <MainLayout>
      <PageHeader
        title="Ayuda / Manual de uso"
        description="Guía operativa del sistema orientada a los circuitos comerciales."
      />

      {/* Mobile tabs */}
      <div className="md:hidden mb-4">
        <Tabs value={seccionActiva} onValueChange={scrollTo}>
          <TabsList className="w-full overflow-x-auto flex justify-start">
            {secciones.map((s) => (
              <TabsTrigger key={s.id} value={s.id} className="flex-shrink-0">
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        {/* Sidebar índice (desktop) */}
        <aside className="hidden md:block">
          <div className="sticky top-6">
            <Card>
              <CardContent className="p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 pb-2 flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5" />
                  Índice
                </p>
                <nav className="space-y-1">
                  {secciones.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => scrollTo(s.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                        seccionActiva === s.id
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </nav>
              </CardContent>
            </Card>
          </div>
        </aside>

        {/* Contenido */}
        <div className="space-y-10 min-w-0">
          {/* Introducción */}
          <section id="introduccion" className="scroll-mt-6 space-y-4">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Introducción
              </h2>
            </div>
            <Card>
              <CardContent className="p-6 space-y-3 text-sm text-foreground leading-relaxed">
                <p>
                  Es un sistema integral de gestión comercial que combina{" "}
                  <strong>venta en mostrador (POS)</strong>,{" "}
                  <strong>venta mayorista con reparto</strong>, cuenta corriente
                  de clientes, facturación electrónica AFIP y gestión financiera
                  (cajas, cheques, transferencias).
                </p>
                <p>
                  Está pensado para que cada rol —cajero, vendedor, depósito,
                  chofer, encargado y administrador— opere en la parte del
                  circuito que le corresponde, dejando trazabilidad completa
                  desde la toma del pedido hasta el cobro.
                </p>
                <p className="text-muted-foreground">
                  Esta guía se enfoca en <strong>cómo fluye la operación</strong>,
                  no en el listado de botones. Al final hay una referencia
                  rápida por pantalla.
                </p>
              </CardContent>
            </Card>
          </section>

          {/* Roles */}
          <section id="roles" className="scroll-mt-6 space-y-4">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Roles del sistema
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {roles.map((r) => (
                <RolCard key={r.nombre} {...r} />
              ))}
            </div>
          </section>

          {/* Flujos */}
          <section id="flujos" className="scroll-mt-6 space-y-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Flujos principales
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Los circuitos comerciales que atraviesa la operación diaria.
              </p>
            </div>
            <div className="space-y-6">
              {flujos.map((f) => (
                <FlujoStepper key={f.id} {...f} />
              ))}
            </div>
          </section>

          {/* Pantallas */}
          <section id="pantallas" className="scroll-mt-6 space-y-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Pantallas (referencia)
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Qué hace cada pantalla y en qué flujo participa.
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {modulos.map((m) => (
                <PantallaAccordion key={m.modulo} {...m} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </MainLayout>
  );
}