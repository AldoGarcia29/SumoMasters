export type EstadoRobot =
  | 'activo'
  | 'eliminado'
  | 'en espera'
  | 'retirado';

export interface EquipoResumen {
  _id: string;
  nombreEquipo: string;
  institucion?: string;
}

export interface CategoriaResumen {
  _id?: string;
  nombre?: string;
}

export interface Robot {
  _id: string;
  nombreRobot: string;
  equipoId: string | EquipoResumen;
  categoriaId: string | CategoriaResumen;
  peso: number;
  fuerza: number;
  fuerzaNeta: number;
  estado: EstadoRobot;
  imagenUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrearRobot {
  nombreRobot: string;
  equipoId: string;
  categoriaId: string;
  peso: number;
  fuerza: number;
  estado?: EstadoRobot;
  imagenUrl?: string;
}