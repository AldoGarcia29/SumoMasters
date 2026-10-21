// Lista blanca: solo esto sale al público.
// Nada de jueces, observaciones, historial interno, correos ni imágenes base64.

export interface TorneoResumenDto {
  id: string;
  nombre: string;
  fecha: string | null;
  categoria: string | null;
  estado: string | null;
  fase: string | null;
}

export interface TorneoLiveDto extends TorneoResumenDto {
  horaInicio: string | null;
  duracionCombateMin: number;
}

export interface CombateLiveDto {
  numero: number;
  fase: string | null;
  dojo: string;
  bloque: string | null;
  robots: string[];
  estado: string;
  ganador: string | null;
  empate: boolean;
  combatesAntes: number | null;
  horaEstimada: string | null;
}

export interface LiveDto {
  torneo: TorneoLiveDto;
  combates: CombateLiveDto[];
  generadoEn: string;
}
