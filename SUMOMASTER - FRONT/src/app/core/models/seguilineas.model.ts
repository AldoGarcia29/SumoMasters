export interface FilaSeguilineas { posicion: number; robotId: string; nombre: string; ordenLlegada: number; mejorTiempoMs: number | null; intentos: number; }
export interface RegistroReciente { robotId: string; nombre: string; tiempoMs: number; registradoEn: string; }
export interface RankingSeguilineas {
  id: string; nombre: string; fecha: string; estado: string; hayRegistros: boolean;
  ranking: FilaSeguilineas[]; top3: FilaSeguilineas[]; recientes: RegistroReciente[];
}
export const formatearTiempo = (ms: number | null): string => {
  if (ms == null) return '--:--.---';
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), c = ms % 1000;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(3, '0')}`;
};
