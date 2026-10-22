import { Robot } from './robot.model';
import { Dojo } from './dojo.model';

export enum FaseCombate {
  FASE_GRUPOS = 'Fase de grupos',
  PRELIMINAR = 'Ronda preliminar',
  DIECISEISAVOS = 'Dieciseisavos de final',
  OCTAVOS = 'Octavos de final',
  CUARTOS = 'Cuartos de final',
  SEMIFINAL = 'Semifinal',
  TERCER_LUGAR = 'Tercer lugar',
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
  OTRO = 'Otro',
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
  ronda: number | null;
  /** Fecha y hora programada; los combates antiguos pueden no tenerla. */
horarioProgramado?: string | null;
  robot1: Robot;
  robot2: Robot;
  dojo: Dojo | null;
  /** Turno programado del combate. */
  turno: number | null;

  /** Arena simultánea dentro del dojo. */
  arena: number | null;
  estado: EstadoCombate;
  resultado: ResultadoCombate | null;
  metodoVictoria: MetodoVictoria | null;
  otroMetodoVictoria?: string | null;
  duracionSegundos: number | null;
  jueces: string[];
  observaciones: string;
  historial: HistorialEvento[];
  createdAt?: string;
  updatedAt?: string;
}

export interface RegistrarResultadoPayload {
  resultado: ResultadoCombate;
  metodoVictoria: MetodoVictoria;
  otroMetodoVictoria?: string;
  duracionSegundos?: number;
  jueces?: string[];
  observaciones?: string;
}
