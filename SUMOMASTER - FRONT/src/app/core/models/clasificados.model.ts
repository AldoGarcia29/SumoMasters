import { Combate } from './combate.model';

export interface Clasificado {
  posicion: number;
  robotId: string;
  robotNombre: string;
  robotImagenUrl: string;
  equipoId: string;
  equipoNombre: string;
  combates: number;
  victorias: number;
  empates: number;
  derrotas: number;
  puntos: number;
  diferencia: number;
  ultimoResultado:
    | 'Victoria'
    | 'Derrota'
    | 'Empate'
    | null;

  bloqueId: string;
  bloqueNombre: string;
  posicionBloque: number;
  porcentajePuntos: number;
  seedGeneral: number;
  paseDirecto: boolean;
}

export interface BloqueClasificados {
  bloqueId: string;
  bloqueNombre: string;
  clasificados: Clasificado[];
}

export interface CrucePreliminar {
  numero: number;
  robot1: Clasificado;
  robot2: Clasificado;
}

export interface ResumenClasificados {
  bloques: BloqueClasificados[];
  clasificados: Clasificado[];
  pasesDirectos: Clasificado[];
  rondaPreliminar: CrucePreliminar[];

  totalBloques: number;
  clasificadosPorBloque: number;
  totalClasificados: number;

  tamanoCuadro: number;
  totalPasesDirectos: number;
  totalPreliminares: number;
  participantesPrimeraRonda: number;
  requierePreliminar: boolean;
  esCuadroCompleto: boolean;
}

export interface FaseEliminatoriaGenerada
  extends ResumenClasificados {
  combatesGenerados: Combate[];
}