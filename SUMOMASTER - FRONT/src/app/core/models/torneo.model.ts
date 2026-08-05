import { Categoria } from './categoria.model';
import { Robot } from './robot.model';

export enum EstadoTorneo {
  PROGRAMADO = 'Programado',
  EN_PROGRESO = 'En progreso',
  FINALIZADO = 'Finalizado',
}

export interface Torneo {
  _id: string;
  nombre: string;
  fecha: string;
  descripcion?: string;
  categoria: Categoria | string;
  estado: EstadoTorneo;
  robotsInscritos: (Robot | string)[];
  tamanioBloque: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TorneoPayload {
  nombre: string;
  fecha: string;
  descripcion?: string;
  categoria: string;
  estado?: EstadoTorneo;
  robotsInscritos?: string[];
  tamanioBloque?: number;
}
