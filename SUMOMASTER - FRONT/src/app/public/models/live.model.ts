export interface TorneoResumen {
  id: string;
  nombre: string;
  fecha: string | null;
  categoria: string | null;
  estado: string | null;
  fase: string | null;
}

export interface RobotLive {
  nombre: string;
  imagenUrl: string | null;
}

export interface CombateLive {
  id?: string;
  numero: number;
  fase: string | null;
  ronda?: number | null;
  horarioProgramado?: string | null;

  dojo: string;
  bloque: string | null;
  robots: string[];

  robot1?: RobotLive | null;
  robot2?: RobotLive | null;

  estado: string;
  ganador: string | null;
  empate: boolean;
  combatesAntes: number | null;
  horaEstimada: string | null;
}

export interface LiveData {
  torneo: TorneoResumen & {
    horaInicio: string | null;
    duracionCombateMin: number;
  };
  combates: CombateLive[];
  generadoEn: string;
}

export interface FilaRankingPublica {
  posicion: number;
  robot: string;
  equipo: string;
  combates: number;
  victorias: number;
  empates: number;
  derrotas: number;
  puntos: number;
  diferencia: number;
  ultimoResultado: 'Victoria' | 'Derrota' | 'Empate' | null;
}

export interface RankingPublico {
  filas: FilaRankingPublica[];
  generadoEn: string;
}