export enum TipoCombate {
  SUMO = 'Sumo',
  SUMO_AUTONOMO = 'Sumo Autónomo',
  SUMO_RC = 'Sumo RC',
}

export enum EstadoCategoria {
  ACTIVA = 'Activa',
  EN_PREPARACION = 'En preparación',
  INACTIVA = 'Inactiva',
}

export interface Categoria {
  _id: string;
  nombre: string;
  descripcion: string;
  pesoMaximoKg: number | null;
  tipoCombate: TipoCombate;
  estado: EstadoCategoria;
  color?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoriaPayload {
  nombre: string;
  descripcion: string;
  pesoMaximoKg?: number | null;
  tipoCombate: TipoCombate;
  estado?: EstadoCategoria;
  color?: string;
}
