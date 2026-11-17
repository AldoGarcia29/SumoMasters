import { Categoria } from './categoria.model';
import { Robot } from './robot.model';
import { Equipo } from './equipo.model';

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
  equiposInscritos?: (Pick<Equipo, '_id' | 'nombre'> | string)[];
  gruposRoboSoccer?: GrupoRoboSoccer[];
  participantes?: { robot: Robot | string; numero: number }[];
  ultimoNumero?: number;
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
  equiposInscritos?: string[];
  tamanioBloque?: number;
}

export interface PartidoDeGrupo {
  localId: string;
  visitanteId: string;
  resultado: { golesLocal: number; golesVisitante: number } | null;
}

export interface GrupoRoboSoccer {
  numero: number;
  nombre: string;
  equipoIds: string[];
  partidos: PartidoDeGrupo[];
}

export type RondaInicialRoboSoccer =
  | 'DIECISEISAVOS'
  | 'OCTAVOS'
  | 'CUARTOS'
  | 'SEMIFINAL'
  | 'FINAL';

export interface CruceInicialRoboSoccer {
  localId: string | null;
  visitanteId: string | null;
}

export interface GuardarLlaveRoboSoccerPayload {
  rondaInicial: RondaInicialRoboSoccer;
  crucesIniciales: CruceInicialRoboSoccer[];
}

export interface CruceLlaveRoboSoccer extends CruceInicialRoboSoccer {
  id: string;
  ronda: RondaInicialRoboSoccer | 'TERCER_LUGAR';
  ganadorId: string | null;
  resuelto: boolean;
}

export interface CuadroLlaveRoboSoccer {
  rondas: {
    ronda: RondaInicialRoboSoccer;
    cruces: CruceLlaveRoboSoccer[];
  }[];
  tercerLugar: CruceLlaveRoboSoccer | null;
  podio: {
    primero: string | null;
    segundo: string | null;
    tercero: string | null;
  };
}

export interface RespuestaLlaveRoboSoccer {
  llave: GuardarLlaveRoboSoccerPayload | null;
  cuadro: CuadroLlaveRoboSoccer | null;
}

export interface CambiarGanadorRoboSoccerPayload {
  localId: string;
  visitanteId: string;
  ganadorId: string;
}