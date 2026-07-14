export type EstadoCategoria = 'activa' | 'inactiva';

export type TipoCombate =
  | 'Sumo'
  | 'Autónomo'
  | 'Radio Control';

export interface Categoria {
  _id: string;
  nombre: string;
  descripcion: string;
  pesoMaximo: number;
  tipoCombate: TipoCombate;
  reglas: string;
  estado: EstadoCategoria;
  createdAt?: string;
  updatedAt?: string;
}