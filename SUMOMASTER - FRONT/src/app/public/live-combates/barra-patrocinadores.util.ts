import {
  FilaSeguilineas,
  RankingSeguilineas,
  etiquetaResultado,
  formatearTiempo,
} from '../../core/models/seguilineas.model';

/** Cada cuánto cambia lo que muestra la barra. */
export const TICKER_MS = 30_000;
/** Robots por pantalla: a 5 s por robot una vuelta completa dura justo 30 s. */
export const POR_PAGINA = 6;
/** Máximo de resultados nuevos acumulados en una misma alerta. */
export const MAX_ALERTAS = 5;
/** Un torneo que aparece de golpe solo alerta resultados registrados hace menos de esto. */
const VENTANA_TORNEO_NUEVO_MS = 120_000;

const MEDALLAS = ['🥇', '🥈', '🥉'];

export interface RefResultado {
  torneoId: string;
  robotId: string;
}

export interface ItemBarra {
  texto?: string;
  logo?: string;
}

const clave = (torneoId: string, robotId: string): string =>
  `${torneoId}|${robotId}`;

/** Cambia si el robot registra, mejora, corrige o le borran el resultado. */
const firma = (f: FilaSeguilineas): string =>
  `${f.estadoRegistro}|${f.mejorTiempoMs ?? ''}|${f.registradoEn ?? ''}`;

export function fotografiar(torneos: RankingSeguilineas[]): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const t of torneos)
    for (const f of t.ranking)
      if (f.estadoRegistro) mapa.set(clave(t.id, f.robotId), firma(f));
  return mapa;
}

/**
 * Compara el estado anterior con el actual y devuelve los resultados nuevos o
 * modificados, el más reciente primero. `previo` es null en la primera carga:
 * ahí no se alerta nada (solo se toma la foto).
 */
export function detectarNuevos(
  previo: { firmas: Map<string, string>; torneoIds: Set<string> } | null,
  torneos: RankingSeguilineas[],
): RefResultado[] {
  if (!previo) return [];
  const nuevos: { ref: RefResultado; en: number }[] = [];
  for (const t of torneos) {
    const torneoConocido = previo.torneoIds.has(t.id);
    for (const f of t.ranking) {
      if (!f.estadoRegistro) continue;
      if (previo.firmas.get(clave(t.id, f.robotId)) === firma(f)) continue;
      const en = f.registradoEn ? Date.parse(f.registradoEn) : 0;
      // Torneo recién activo (p. ej. reabierto): no repetir resultados viejos.
      // El primer tiempo de un torneo también llega así, pero es reciente.
      if (!torneoConocido && t.generadoEn - en > VENTANA_TORNEO_NUEVO_MS)
        continue;
      nuevos.push({ ref: { torneoId: t.id, robotId: f.robotId }, en });
    }
  }
  return nuevos
    .sort((a, b) => b.en - a.en)
    .slice(0, MAX_ALERTAS)
    .map((n) => n.ref);
}

/** Texto de un resultado recién registrado: tiempo · robot · lugar actual. */
export function textoAlerta(
  f: FilaSeguilineas,
  torneoNombre: string | null,
): string {
  const torneo = torneoNombre ? ` · ${torneoNombre}` : '';
  if (f.estadoRegistro === 'VALIDO')
    return `⏱ ${formatearTiempo(f.mejorTiempoMs)} · ${f.nombre} · ${f.posicion}° lugar${torneo}`;
  // DNF / descalificado: no hay tiempo ni lugar que anunciar.
  const icono = f.estadoRegistro === 'DNF' ? '⚠' : '⛔';
  return `${icono} ${etiquetaResultado(f.estadoRegistro, null)} · ${f.nombre}${torneo}`;
}

/** Una fila de la tabla de posiciones: "🥇 1° Robot · 00:12.345". */
export function textoPosicion(f: FilaSeguilineas): string {
  const medalla = f.estadoRegistro === 'VALIDO' ? MEDALLAS[f.posicion - 1] : undefined;
  return `${medalla ? medalla + ' ' : ''}${f.posicion}° ${f.nombre} · ${etiquetaResultado(f.estadoRegistro, f.mejorTiempoMs)}`;
}

export function paginar<T>(items: T[], tam = POR_PAGINA): T[][] {
  const paginas: T[][] = [];
  for (let i = 0; i < items.length; i += tam) paginas.push(items.slice(i, i + tam));
  return paginas;
}
