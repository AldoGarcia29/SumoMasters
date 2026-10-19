export interface TorneoResumen {
  id: string;
  nombre: string;
  fecha: string | null;
  categoria: string | null;
  estado: string | null;
  fase: string | null;
}

export interface CombateLive {
  numero: number;
  fase: string | null;
  dojo: string;
  robots: string[];
  estado: string;
  ganador: string | null;
  combatesAntes: number | null;
  horaEstimada: string | null;
}

export interface LiveData {
  torneo: TorneoResumen & { horaInicio: string | null; duracionCombateMin: number };
  combates: CombateLive[];
  generadoEn: string;
}
