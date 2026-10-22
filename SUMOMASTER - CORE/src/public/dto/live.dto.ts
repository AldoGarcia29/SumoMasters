// Lista blanca: solo esto sale al público.
// Nada de jueces, observaciones, historial interno, correos ni imágenes base64.

export interface TorneoResumenDto {
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

export interface TorneoLiveDto extends TorneoResumenDto {
  horaInicio: string | null;
  duracionCombateMin: number;
}

export interface CombateLiveDto {
  id: string;
  numero: number;
  fase: string | null;
  ronda: number | null;
  horarioProgramado: string | null;
  dojo: string;
  bloque: string | null;
  robots: string[];
  robotsDetalle: {
    id: string | null;
    numero: number | null;
    nombre: string;
  }[];
  robot1: RobotFotoLiveDto | null;
  robot2: RobotFotoLiveDto | null;
  estado: string;
  ganador: string | null;
  ganadorNumero: number | null;
  metodoVictoria: string | null;
  empate: boolean;
  combatesAntes: number | null;
  horaEstimada: string | null;
}

export interface RobotFotoLiveDto {
  nombre: string;
  imagenUrl: string | null;
}

export interface RobotLiveDto {
  id: string;
  numero: number | null;
  nombre: string;
  equipo: string;
  institucion: string;
  categoria: string;
  pesoKg: number | null;
  grupo: string | null;
}

export interface GrupoLiveDto {
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
}

export interface PodioLugarLiveDto {
  robotId: string;
  numero: number | null;
  robot: string;
}

export interface PodioLiveDto {
  campeon: PodioLugarLiveDto;
  subcampeon: PodioLugarLiveDto;
  tercerLugar: PodioLugarLiveDto | null;
  cuartoLugar: PodioLugarLiveDto | null;
}

export interface FichaRobotPublicaDto {
  torneoId: string;
  robot: {
    id: string;
    nombre: string;
    numero: number | null;
    pesoKg: number | null;
  };
  equipo: { nombre: string; institucion: string };
  categoria: string;
  grupo: string | null;
  dojo: string | null;
  record: { victorias: number; derrotas: number };
  ultimoCombate: {
    numero: number;
    fase: string;
    estado: string;
    dojo: string | null;
    rival: string;
    horarioProgramado: string | null;
  } | null;
  proximoCombate: {
    numero: number;
    fase: string;
    estado: string;
    dojo: string | null;
    rival: string;
    horarioProgramado: string | null;
  } | null;
}

export interface LiveDto {
  torneo: TorneoLiveDto;
  combates: CombateLiveDto[];
  robots: RobotLiveDto[];
  grupos: GrupoLiveDto[];
  podio: PodioLiveDto | null;
  generadoEn: string;
}
