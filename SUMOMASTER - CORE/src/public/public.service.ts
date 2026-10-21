import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

// AJUSTA estas 2 rutas y nombres a tus schemas reales
import { Torneo, TorneoDocument } from '../torneos/schemas/torneo.schema';
import { Combate, CombateDocument } from '../combates/schemas/combate.schema';

import {
  EstadoCombate,
  FaseCombate,
  ResultadoCombate,
} from '../combates/enums/combate.enums';
import { DURACION_COMBATE_DEFAULT_MIN } from './public.constants';
import { CombateLiveDto, LiveDto, TorneoResumenDto } from './dto/live.dto';
import { RankingService } from '../ranking/ranking.service';

// Ranking público (fase de grupos): sin ids internos ni imágenes base64.
export interface FilaRankingPublicaDto {
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

export interface RankingPublicoDto {
  filas: FilaRankingPublicaDto[];
  generadoEn: string;
}

/** Saca un nombre legible venga como string, objeto populado o ObjectId. */
function nombreDe(x: any): string {
  if (x === null || x === undefined) return '';
  if (typeof x === 'string') return x;
  if (typeof x === 'object' && 'nombre' in x) return String(x.nombre);
  return String(x);
}

function aISO(d: unknown): string | null {
  if (!d) return null;
  const f = new Date(d as any);
  return isNaN(f.getTime()) ? null : f.toISOString();
}

/** Orden cronológico de las fases del torneo. */
const ORDEN_FASES: string[] = Object.values(FaseCombate);
const ordenFase = (f: unknown): number => {
  const i = ORDEN_FASES.indexOf(String(f));
  return i === -1 ? 99 : i;
};
const SIN_ORDEN = 1_000_000;

/** Orden de la cola: fase, turno, arena, bloque y número de combate. */
function porOrden(a: any, b: any): number {
  return (
    ordenFase(a.fase) - ordenFase(b.fase) ||
    (a.turno ?? SIN_ORDEN) - (b.turno ?? SIN_ORDEN) ||
    (a.arena ?? SIN_ORDEN) - (b.arena ?? SIN_ORDEN) ||
    nombreDe(a.bloque).localeCompare(nombreDe(b.bloque)) ||
    a.numero - b.numero
  );
}

@Injectable()
export class PublicService {
  constructor(
    @InjectModel(Torneo.name)
    private readonly torneoModel: Model<TorneoDocument>,
    @InjectModel(Combate.name)
    private readonly combateModel: Model<CombateDocument>,
    private readonly rankingService: RankingService,
  ) {}

  async listarTorneosPublicos(): Promise<TorneoResumenDto[]> {
    const torneos: any[] = await this.torneoModel
      .find({ publico: true })
      .select('nombre fecha categoria estado fase') // AJUSTA nombres de campos
      .sort({ fecha: -1 })
      .lean();

    return torneos.map((t) => ({
      id: String(t._id),
      nombre: t.nombre,
      fecha: aISO(t.fecha),
      categoria: t.categoria ? nombreDe(t.categoria) : null,
      estado: t.estado ?? null,
      fase: t.fase ?? null,
    }));
  }

  async armarLive(torneoId: string): Promise<LiveDto | null> {
    const t: any = await this.torneoModel
      .findOne({ _id: torneoId, publico: true })
      .select('nombre fecha categoria estado horaInicio duracionCombateMin')
      .lean();
    if (!t) return null;

    // Campos reales del schema Combate: robot1, robot2, resultado (no existen "robots" ni "ganador").
    // Solo se publican nombres: nunca imágenes, jueces ni observaciones.
    const combates: any[] = await this.combateModel
      .find({ torneo: torneoId })
      .select(
        'numero fase bloque dojo turno arena estado resultado robot1 robot2',
      )
      .populate('robot1', 'nombre')
      .populate('robot2', 'nombre')
      .populate('dojo', 'nombre')
      .populate('bloque', 'nombre')
      .lean();

    combates.sort(porOrden);

    const durMin = t.duracionCombateMin ?? DURACION_COMBATE_DEFAULT_MIN;
    const durMs = durMin * 60_000;
    const inicio = t.horaInicio ? new Date(t.horaInicio).getTime() : null;

    // Cada dojo tiene su propia cola de combates pendientes.
    const pendientesPorDojo = new Map<string, number>();

    const salida: CombateLiveDto[] = combates.map((c) => {
      const estado = String(c.estado);
      const terminado = estado === EstadoCombate.FINALIZADO;
      const dojo = c.dojo ? nombreDe(c.dojo) : '';
      const robot1 = nombreDe(c.robot1);
      const robot2 = nombreDe(c.robot2);

      let combatesAntes: number | null = null;
      let horaEstimada: string | null = null;

      // Sin dojo asignado no se puede estimar la cola.
      if (!terminado && dojo) {
        const antes = pendientesPorDojo.get(dojo) ?? 0;
        combatesAntes = antes;
        horaEstimada =
          inicio === null
            ? null
            : new Date(
                Math.max(Date.now(), inicio) + antes * durMs,
              ).toISOString();
        pendientesPorDojo.set(dojo, antes + 1);
      }

      const ganador =
        c.resultado === ResultadoCombate.GANA_ROBOT_1
          ? robot1
          : c.resultado === ResultadoCombate.GANA_ROBOT_2
            ? robot2
            : null;

      return {
        numero: c.numero,
        fase: c.fase ? nombreDe(c.fase) : null,
        dojo,
        bloque: c.bloque ? nombreDe(c.bloque) : null,
        robots: [robot1, robot2].filter(Boolean),
        estado,
        ganador,
        empate: c.resultado === ResultadoCombate.EMPATE,
        combatesAntes,
        horaEstimada,
      };
    });

    // Fase actual: la del primer combate sin terminar (o la última si ya terminó todo).
    const sinTerminar = combates.find(
      (c) => String(c.estado) !== EstadoCombate.FINALIZADO,
    );
    const faseActual =
      (sinTerminar ?? combates[combates.length - 1])?.fase ?? null;

    return {
      torneo: {
        id: String(t._id),
        nombre: t.nombre,
        fecha: aISO(t.fecha),
        categoria: t.categoria ? nombreDe(t.categoria) : null,
        estado: t.estado ?? null,
        fase: faseActual,
        horaInicio: aISO(t.horaInicio),
        duracionCombateMin: durMin,
      },
      combates: salida,
      generadoEn: new Date().toISOString(),
    };
  }

  /** Ranking de fase de grupos, solo para torneos públicos. */
  async armarRanking(torneoId: string): Promise<RankingPublicoDto | null> {
    const existe = await this.torneoModel.exists({
      _id: torneoId,
      publico: true,
    });
    if (!existe) return null;

    const filas = await this.rankingService.calcular(torneoId);

    // Lista blanca: sin robotId/equipoId ni robotImagenUrl (puede ser base64 pesado)
    return {
      filas: filas.map((f) => ({
        posicion: f.posicion,
        robot: f.robotNombre,
        equipo: f.equipoNombre,
        combates: f.combates,
        victorias: f.victorias,
        empates: f.empates,
        derrotas: f.derrotas,
        puntos: f.puntos,
        diferencia: f.diferencia,
        ultimoResultado: f.ultimoResultado,
      })),
      generadoEn: new Date().toISOString(),
    };
  }
}
