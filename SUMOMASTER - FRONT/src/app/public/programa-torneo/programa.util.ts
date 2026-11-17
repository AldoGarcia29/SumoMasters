/**
 * Convierte la lista plana de combates en el formato del Excel:
 * GRUPOS → RONDA 1/2/3 (Hora | Dojo | Competidores) → FINALES (llaves).
 * Es TypeScript puro (sin Angular) para poder probarlo aparte.
 */

export interface ProgramaCombate {
  numero: number;
  fase?: string | null;
  bloque?: string | null;
  dojo?: string | null;
  robots: string[];
  estado: string;
  ganador?: string | null;
  empate?: boolean;
  horaEstimada?: string | Date | null;
  // Campos que el backend ya guarda en Combate; falta exponerlos en el feed /live.
  ronda?: number | null;
  turno?: number | null;
  horarioProgramado?: string | Date | null;
}

export interface RobotGrupo { seed: string; nombre: string; v: number; e: number; d: number }
export interface GrupoVista { etiqueta: string; robots: RobotGrupo[] }

export interface DueloVista {
  robot1: string | null;
  robot2: string | null;
  /** 0 = sin ganador, 1 = gana robot1, 2 = gana robot2 */
  ganador: 0 | 1 | 2;
  empate: boolean;
  enVivo: boolean;
  estado: string;
}
export interface FilaRonda extends DueloVista { dojo: string }
export interface SlotVista { hora: Date | null; turno: number | null; filas: FilaRonda[] }
export interface RondaVista { numero: number; slots: SlotVista[] }

export interface LlaveVista extends DueloVista { hora: Date | null }
export interface EtapaVista { clave: string; titulo: string; llaves: LlaveVista[] }

export interface ProgramaVista {
  grupos: GrupoVista[];
  rondas: RondaVista[];
  etapas: EtapaVista[];
  tercerLugar: LlaveVista | null;
  campeon: string | null;
}

export const PROGRAMA_VACIO: ProgramaVista = {
  grupos: [], rondas: [], etapas: [], tercerLugar: null, campeon: null,
};

// ── helpers ──────────────────────────────────────────────
const natural = (a: string, b: string) => a.localeCompare(b, 'es', { numeric: true });

const aFecha = (v: unknown): Date | null => {
  if (!v) return null;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d;
};

const ETAPAS: Array<[string, RegExp]> = [
  ['grupos', /grupo/i],
  ['octavos', /octavo/i],
  ['cuartos', /cuarto/i],
  ['tercero', /tercer/i],
  ['semi', /semi/i], // antes que "final": "Semifinal" contiene "final"
  ['final', /final/i],
];
const faseKey = (f?: string | null): string =>
  ETAPAS.find(([, re]) => re.test(f ?? ''))?.[0] ?? 'otra';

const ORDEN_LLAVES = ['octavos', 'cuartos', 'semi', 'final'];
const TITULO: Record<string, string> = {
  octavos: 'Octavos', cuartos: 'Cuartos', semi: 'Semifinal', final: 'Final',
};

const ganadorIdx = (c: ProgramaCombate): 0 | 1 | 2 => {
  if (!c.ganador) return 0;
  if (c.robots[0] === c.ganador) return 1;
  if (c.robots[1] === c.ganador) return 2;
  return 0;
};

const duelo = (c: ProgramaCombate): DueloVista => ({
  robot1: c.robots?.[0] ?? null,
  robot2: c.robots?.[1] ?? null,
  ganador: ganadorIdx(c),
  empate: !!c.empate,
  enVivo: /curso|vivo/i.test(c.estado ?? ''),
  estado: c.estado,
});

const horaDe = (c: ProgramaCombate) => aFecha(c.horarioProgramado) ?? aFecha(c.horaEstimada);

// ── constructor principal ────────────────────────────────
export function construirPrograma(combates: ProgramaCombate[]): ProgramaVista {
  if (!combates?.length) return PROGRAMA_VACIO;

  const deGrupos = combates.filter((c) => faseKey(c.fase) === 'grupos');

  // Agrupa por bloque
  const porBloque = new Map<string, ProgramaCombate[]>();
  for (const c of deGrupos) {
    const k = c.bloque ?? 'Sin grupo';
    if (!porBloque.has(k)) porBloque.set(k, []);
    porBloque.get(k)!.push(c);
  }
  const bloques = [...porBloque.entries()].sort(([a], [b]) => natural(a, b));

  // Si el feed aún no trae `ronda`, se deduce: round-robin, N/2 combates por ronda.
  const rondaDe = new Map<ProgramaCombate, number>();
  const grupos: GrupoVista[] = bloques.map(([nombre, lista], gi) => {
    lista.sort((a, b) => a.numero - b.numero);
    const m = lista.length;
    const nRobots = Math.round((1 + Math.sqrt(1 + 8 * m)) / 2);
    const porRonda = Math.max(1, Math.floor(nRobots / 2));
    lista.forEach((c, i) => rondaDe.set(c, c.ronda ?? Math.ceil((i + 1) / porRonda)));

    // El orden de aparición en la ronda 1 respeta A1, A2, A3, A4 (así lo genera el back).
    const orden = [...lista].sort((a, b) => rondaDe.get(a)! - rondaDe.get(b)! || a.numero - b.numero);
    const nombres: string[] = [];
    orden.forEach((c) => c.robots.forEach((r) => r && !nombres.includes(r) && nombres.push(r)));

    const letra = nombre.replace(/^bloque\s*/i, '').trim() || String.fromCharCode(65 + gi);
    const robots = nombres.map((n, i) => {
      let v = 0, e = 0, d = 0;
      for (const c of lista) {
        if (!c.robots.includes(n)) continue;
        if (c.empate) e++;
        else if (c.ganador) c.ganador === n ? v++ : d++;
      }
      return { seed: `${letra}${i + 1}`, nombre: n, v, e, d };
    });
    return { etiqueta: `GRUPO ${letra}`.toUpperCase(), robots };
  });

  // Rondas: dentro de cada una, se agrupa por turno (= franja de hora, todos los dojos en paralelo)
  const numerosRonda = [...new Set(deGrupos.map((c) => rondaDe.get(c)!))].sort((a, b) => a - b);
  const rondas: RondaVista[] = numerosRonda.map((numero) => {
    const delaRonda = deGrupos.filter((c) => rondaDe.get(c) === numero);
    const slots = new Map<string, ProgramaCombate[]>();
    for (const c of delaRonda) {
      const hora = horaDe(c);
      const k = c.turno != null ? `t${c.turno}` : hora ? `h${hora.getTime()}` : 'sin-turno';
      if (!slots.has(k)) slots.set(k, []);
      slots.get(k)!.push(c);
    }
    const vistaSlots: SlotVista[] = [...slots.values()]
      .map((lista) => {
        lista.sort((a, b) => natural(a.dojo ?? '~', b.dojo ?? '~') || natural(a.bloque ?? '', b.bloque ?? '') || a.numero - b.numero);
        return {
          turno: lista[0].turno ?? null,
          hora: lista.map(horaDe).find((h) => h) ?? null,
          filas: lista.map((c) => ({ ...duelo(c), dojo: c.dojo ?? 'Por asignar' })),
        };
      })
      .sort((a, b) => (a.turno ?? 1e9) - (b.turno ?? 1e9) || (a.hora?.getTime() ?? 1e15) - (b.hora?.getTime() ?? 1e15));
    return { numero, slots: vistaSlots };
  });

  // Finales
  const finales = new Map<string, ProgramaCombate[]>();
  for (const c of combates) {
    const k = faseKey(c.fase);
    if (k === 'grupos' || k === 'otra') continue;
    if (!finales.has(k)) finales.set(k, []);
    finales.get(k)!.push(c);
  }
  finales.forEach((l) => l.sort((a, b) => a.numero - b.numero));

  const llave = (c: ProgramaCombate): LlaveVista => ({ ...duelo(c), hora: horaDe(c) });
  const llaveVacia = (): LlaveVista => ({
    robot1: null, robot2: null, ganador: 0, empate: false, enVivo: false, estado: 'Pendiente', hora: null,
  });

  const primera = ORDEN_LLAVES.findIndex((k) => finales.has(k));
  const etapas: EtapaVista[] = [];
  if (primera >= 0) {
    let esperado = 0;
    for (let i = primera; i < ORDEN_LLAVES.length; i++) {
      const k = ORDEN_LLAVES[i];
      const db = (finales.get(k) ?? []).map(llave);
      const n = Math.max(db.length, esperado, k === 'final' ? 1 : 0);
      const llaves = [...db, ...Array.from({ length: n - db.length }, llaveVacia)];
      etapas.push({ clave: k, titulo: TITULO[k], llaves });
      esperado = Math.max(1, Math.floor(n / 2));
    }
  }

  const final = etapas.find((e) => e.clave === 'final')?.llaves[0];
  const campeon = final?.ganador ? (final.ganador === 1 ? final.robot1 : final.robot2) : null;
  const t = finales.get('tercero')?.[0];

  return { grupos, rondas, etapas, tercerLugar: t ? llave(t) : null, campeon };
}
