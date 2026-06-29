import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useVersionCheck, forceReloadApp } from "@/hooks/useVersionCheck";
import { useState } from "react";

export function UpdateBanner() {
  const hasNewVersion = useVersionCheck();
  const [updating, setUpdating] = useState(false);

  if (!hasNewVersion) return null;

  const handleUpdate = async () => {
    setUpdating(true);
    await forceReloadApp();
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-sm rounded-lg border border-primary/30 bg-background shadow-lg p-4 flex items-start gap-3 animate-in slide-in-from-bottom">
      <RefreshCw className="h-5 w-5 text-primary mt-0.5 shrink-0" />
      <div className="flex-1 space-y-2">
        <p className="text-sm font-medium">
          Hay una nueva versión del sistema disponible.
        </p>
        <Button size="sm" onClick={handleUpdate} disabled={updating} className="w-full">
          {updating ? "Actualizando..." : "Actualizar"}
        </Button>
      </div>
    </div>
  );
}