import { Categoria } from './categoria.model';

export interface Integrante {
  nombre: string;
  rol?: string;
}

export interface Equipo {
  _id: string;
  nombre: string;
  institucion: string;
  categoria: Categoria | string;
  integrantes: Integrante[];
  robotsCount: number;
  logoIniciales?: string;
  logoUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EquipoPayload {
  nombre: string;
  institucion: string;
  categoria: string;
  integrantes: Integrante[];
  logoIniciales?: string;
  logoUrl?: string;
}
