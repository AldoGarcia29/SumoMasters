import { Robot } from './robot.model';

export interface Bloque {
  _id: string;
  torneo: string;
  nombre: string;
  robots: Robot[];
}

export interface GenerarBloquesPayload {
  cantidadBloques: number;
}