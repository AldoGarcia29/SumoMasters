import { Robot } from './robot.model';
import { Dojo } from './dojo.model';

export enum FaseCombate {
  FASE_GRUPOS = 'Fase de grupos',
  OCTAVOS = 'Octavos de final',
  CUARTOS = 'Cuartos de final',
  SEMIFINAL = 'Semifinal',
  FINAL = 'Final',
}

export enum EstadoCombate {
  PENDIENTE = 'Pendiente',
  EN_CURSO = 'En curso',
  FINALIZADO = 'Finalizado',
}

export enum ResultadoCombate {
  GANA_ROBOT_1 = 'Gana Robot 1',
  GANA_ROBOT_2 = 'Gana Robot 2',
  EMPATE = 'Empate',
}

export enum MetodoVictoria {
  EMPUJE_FUERA = 'Empuje fuera del área',
  PUNTOS = 'Puntos',
  KO = 'Fuera de combate (KO)',
  DESCALIFICACION = 'Descalificación',
  ABANDONO = 'Abandono',
}

export interface HistorialEvento {
  hora: string;
  descripcion: string;
  tipo: string;
}

export interface Combate {
  _id: string;
  torneo: string;
  bloque: { _id: string; nombre: string } | null;
  fase: FaseCombate;
  numero: number;
  robot1: Robot;
  robot2: Robot;
  dojo: Dojo | null;
  estado: EstadoCombate;
  resultado: ResultadoCombate | null;
  metodoVictoria: MetodoVictoria | null;
  duracionSegundos: number | null;
  jueces: string[];
  observaciones: string;
  historial: HistorialEvento[];
  createdAt?: string;
  updatedAt?: string;
}

export interface RegistrarResultadoPayload {
  resultado: ResultadoCombate;
  metodoVictoria?: MetodoVictoria;
  duracionSegundos?: number;
  jueces?: string[];
  observaciones?: string;
}
