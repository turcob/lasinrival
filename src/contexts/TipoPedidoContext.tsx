import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export type TipoPedidoFiltro = 'web' | 'reparto' | 'ambos';

interface TipoPedidoContextValue {
  tipo: TipoPedidoFiltro;
  setTipo: (t: TipoPedidoFiltro) => void;
  modalAbierto: boolean;
  setModalAbierto: (v: boolean) => void;
  yaEligio: boolean;
}

const TipoPedidoContext = createContext<TipoPedidoContextValue | null>(null);

const STORAGE_KEY = 'pedidos_tipo_filtro';

export function TipoPedidoProvider({ children }: { children: ReactNode }) {
  const [tipo, setTipoState] = useState<TipoPedidoFiltro>('ambos');
  const [yaEligio, setYaEligio] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved === 'web' || saved === 'reparto' || saved === 'ambos') {
      setTipoState(saved);
      setYaEligio(true);
    } else {
      setModalAbierto(true);
    }
  }, []);

  const setTipo = (t: TipoPedidoFiltro) => {
    setTipoState(t);
    sessionStorage.setItem(STORAGE_KEY, t);
    setYaEligio(true);
  };

  return (
    <TipoPedidoContext.Provider value={{ tipo, setTipo, modalAbierto, setModalAbierto, yaEligio }}>
      {children}
    </TipoPedidoContext.Provider>
  );
}

export function useTipoPedido() {
  const ctx = useContext(TipoPedidoContext);
  if (!ctx) throw new Error('useTipoPedido must be used within TipoPedidoProvider');
  return ctx;
}
