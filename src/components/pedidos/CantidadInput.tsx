import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';

interface CantidadInputProps {
  cantidadInicial: number;
  cantidadMaxima: number;
  esPorPeso: boolean;
  onCantidadChange: (cantidad: number) => void;
  className?: string;
}

const formatCantidad = (cantidad: number, esPorPeso: boolean) => {
  return esPorPeso ? cantidad.toFixed(3).replace('.', ',') : cantidad.toString();
};

export function CantidadInput({
  cantidadInicial,
  cantidadMaxima,
  esPorPeso,
  onCantidadChange,
  className,
}: CantidadInputProps) {
  const [texto, setTexto] = useState(() => formatCantidad(cantidadInicial, esPorPeso));
  const [cantidadActual, setCantidadActual] = useState(cantidadInicial);

  // Reset when initial value changes (e.g., dialog reopened)
  useEffect(() => {
    setTexto(formatCantidad(cantidadInicial, esPorPeso));
    setCantidadActual(cantidadInicial);
  }, [cantidadInicial, esPorPeso]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTexto(e.target.value);
  };

  const handleBlur = useCallback(() => {
    const normalizedValue = texto.replace(',', '.');
    const cantidad = esPorPeso ? (parseFloat(normalizedValue) || 0) : (parseInt(texto) || 0);
    const cantidadFinal = Math.min(Math.max(0, cantidad), cantidadMaxima);
    
    setCantidadActual(cantidadFinal);
    setTexto(formatCantidad(cantidadFinal, esPorPeso));
    onCantidadChange(cantidadFinal);
  }, [texto, esPorPeso, cantidadMaxima, onCantidadChange]);

  const diferencia = cantidadActual !== cantidadMaxima;

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={texto}
      onChange={handleChange}
      onBlur={handleBlur}
      className={`w-24 text-center mx-auto ${diferencia ? 'border-yellow-500' : ''} ${className || ''}`}
    />
  );
}
