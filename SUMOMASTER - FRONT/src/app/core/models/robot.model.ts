import { Categoria } from './categoria.model';
import { Equipo } from './equipo.model';

export enum EstadoRobot {
  ACTIVO = 'Activo',
  MANTENIMIENTO = 'Mantenimiento',
  INACTIVO = 'Inactivo',
  RETIRADO = 'Retirado',
}

export interface Robot {
  _id: string;
  nombre: string;
  equipo: Equipo | string;
  categoria: Categoria | string;
  pesoKg: number | null;
  estado: EstadoRobot;
  imagenUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RobotPayload {
  nombre: string;
  equipo: string;
  categoria: string;
  pesoKg?: number | null;
  estado?: EstadoRobot;
  imagenUrl?: string;
}
