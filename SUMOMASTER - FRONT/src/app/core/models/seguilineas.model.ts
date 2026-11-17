export type EstadoRegistro = 'VALIDO' | 'DNF' | 'DESCALIFICADO';
export type EstadoTurno = 'EN_ESPERA' | 'SIGUIENTE' | 'CORRIO';
export type AccionAuditoria =
  | 'MEJORA'
  | 'REEMPLAZO'
  | 'EDICION'
  | 'ELIMINACION';

export interface ValorAnterior {
  estado?: EstadoRegistro;
  tiempoMs?: number;
}

export interface AuditoriaSeguilineas {
  accion: AccionAuditoria;
  editadoPor: string | null;
  editadoEn: string;
  valorAnterior: ValorAnterior | null;
}

export interface FilaSeguilineas {
  posicion: number;
  robotId: string;
  nombre: string;
  ordenLlegada: number;
  estadoTurno: EstadoTurno;
  estadoRegistro: EstadoRegistro | null;
  mejorTiempoMs: number | null;
  registradoEn: string | null;
  auditoria: AuditoriaSeguilineas | null;
  /** true si otro robot tiene exactamente el mismo mejor tiempo. */
  empatado: boolean;
}

export interface TurnoCola {
  robotId: string;
  nombre: string;
  ordenLlegada: number;
  estadoTurno: EstadoTurno;
  estadoRegistro: EstadoRegistro | null;
  mejorTiempoMs: number | null;
}

export interface RegistroReciente {
  robotId: string;
  nombre: string;
  estadoRegistro: EstadoRegistro;
  tiempoMs: number | null;
  registradoEn: string;
}

export interface PodioFinal {
  posicion: number;
  robotId: string;
  nombre: string;
  mejorTiempoMs: number;
}

export interface RankingSeguilineas {
  id: string;
  nombre: string;
  fecha: string;
  estado: string;
  categoria: string;
  generadoEn: number;
  hayRegistros: boolean;
  ranking: FilaSeguilineas[];
  top3: FilaSeguilineas[];
  /** Podio fijo; solo viene con datos cuando el torneo está Finalizado. */
  podio: PodioFinal[];
  cola: TurnoCola[];
  siguiente: TurnoCola | null;
  hayEmpates: boolean;
  recientes: RegistroReciente[];
}

export interface TorneoSeguilineas {
  _id: string;
  nombre: string;
  fecha: string;
  estado: string;
  descripcion?: string;
  staffAsignados?: string[];
  categoria?: { _id: string; nombre: string; tipoCombate: string; color?: string } | string;
}

export const formatearTiempo = (ms: number | null | undefined): string => {
  if (ms == null) return '--:--.---';
  const m = Math.floor(ms / 60000),
    s = Math.floor((ms % 60000) / 1000),
    c = ms % 1000;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(3, '0')}`;
};

/** Texto legible del resultado de un robot: tiempo, DNF, DQ o "en espera". */
export const etiquetaResultado = (
  estado: EstadoRegistro | null | undefined,
  tiempoMs: number | null | undefined,
): string => {
  if (estado === 'VALIDO') return formatearTiempo(tiempoMs);
  if (estado === 'DNF') return 'DNF';
  if (estado === 'DESCALIFICADO') return 'DESCALIFICADO';
  return 'En espera';
};

export const parsearTiempo = (texto: string): number | null => {
  const m = texto.trim().match(/^(?:(\d{1,2}):)?(\d{1,3})(?:\.(\d{1,3}))?$/);
  if (!m) return null;
  const ms =
    Number(m[1] ?? 0) * 60_000 +
    Number(m[2]) * 1_000 +
    Number((m[3] ?? '0').padEnd(3, '0'));
  return ms > 0 && ms <= 3_600_000 ? ms : null;
};
