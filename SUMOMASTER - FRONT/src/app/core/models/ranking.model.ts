export interface FilaRanking {
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
  ultimoResultado: 'Victoria' | 'Derrota' | 'Empate' | null;
}
