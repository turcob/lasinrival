import { useEffect, useState } from "react";

const CURRENT_VERSION =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

/**
 * Detecta si hay una nueva versión publicada comparando
 * la versión embebida en el bundle contra /version.json del servidor.
 */
export function useVersionCheck(intervalMs = 5 * 60 * 1000) {
  const [hasNewVersion, setHasNewVersion] = useState(false);

  useEffect(() => {
    if (CURRENT_VERSION === "dev") return;
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { version?: string };
        if (!cancelled && data?.version && data.version !== CURRENT_VERSION) {
          setHasNewVersion(true);
        }
      } catch {
        /* silencioso: red intermitente */
      }
    };

    check();
    const interval = window.setInterval(check, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, [intervalMs]);

  return hasNewVersion;
}

export async function forceReloadApp() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(regs.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.allSettled(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* continuar con el reload */
  }
  window.location.reload();
}