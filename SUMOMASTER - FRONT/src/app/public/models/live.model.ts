export interface TorneoResumen {
  id: string;
  nombre: string;
  fecha: string | null;
  categoria: string | null;
  estado: string | null;
  fase: string | null;
  robots: number;
  combates: number;
  combatesEnCurso: number;
  combatesPendientes: number;
  campeon: string | null;
}

export interface RobotLive {
  nombre: string;
  imagenUrl: string | null;
}

export interface RobotDetalleLive {
  id: string | null;
  numero: number | null;
  nombre: string;
}

export interface CombateLive {
  id: string;
  numero: number;
  fase: string | null;
  ronda: number | null;
  horarioProgramado: string | null;
  dojo: string;
  bloque: string | null;
  robots: string[];
  robotsDetalle: RobotDetalleLive[];
  robot1: RobotLive | null;
  robot2: RobotLive | null;
  estado: string;
  ganador: string | null;
  ganadorNumero: number | null;
  metodoVictoria: string | null;
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
  robots: {
    id: string;
    numero: number | null;
    nombre: string;
    equipo: string;
    institucion: string;
    categoria: string;
    pesoKg: number | null;
    grupo: string | null;
  }[];
  grupos: {
    nombre: string;
    filas: {
      robotId: string;
      numero: number | null;
      robot: string;
      equipo: string;
      combates: number;
      victorias: number;
      empates: number;
      derrotas: number;
      puntos: number;
    }[];
  }[];
  podio: {
    campeon: { robotId: string; numero: number | null; robot: string };
    subcampeon: { robotId: string; numero: number | null; robot: string };
    tercerLugar: { robotId: string; numero: number | null; robot: string } | null;
    cuartoLugar: { robotId: string; numero: number | null; robot: string } | null;
  } | null;
  generadoEn: string;
}

export interface FilaRankingPublica {
  robotId: string;
  numero: number | null;
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