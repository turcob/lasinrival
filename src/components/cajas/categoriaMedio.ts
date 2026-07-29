export type CategoriaMedio =
  | 'efectivo' | 'debito' | 'credito' | 'transferencia' | 'cheque' | 'otro';

export const CATEGORIAS_NO_EFECTIVO: Exclude<CategoriaMedio, 'efectivo'>[] = [
  'debito', 'credito', 'transferencia', 'cheque', 'otro',
];

export const LABEL_CATEGORIA: Record<CategoriaMedio, string> = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  credito: 'Crédito',
  transferencia: 'Transferencia',
  cheque: 'Cheque',
  otro: 'Otro',
};