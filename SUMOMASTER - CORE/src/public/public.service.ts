import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

// AJUSTA estas 2 rutas y nombres a tus schemas reales
import { Torneo, TorneoDocument } from '../torneos/schemas/torneo.schema';
import { Combate, CombateDocument } from '../combates/schemas/combate.schema';

import {
  EstadoCombate,
  FaseCombate,
  ResultadoCombate,
} from '../combates/enums/combate.enums';
import { DURACION_COMBATE_DEFAULT_MIN } from './public.constants';
import {
  CombateLiveDto,
  GrupoLiveDto,
  LiveDto,
  PodioLugarLiveDto,
  RobotLiveDto,
  TorneoResumenDto,
} from './dto/live.dto';
import { RankingService } from '../ranking/ranking.service';
import { Robot, RobotDocument } from '../robots/schemas/robot.schema';
import { Bloque, BloqueDocument } from '../bloques/schemas/bloque.schema';

// Ranking público (fase de grupos): sin ids internos ni imágenes base64.
export interface FilaRankingPublicaDto {
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
    @InjectModel(Robot.name)
    private readonly robotModel: Model<RobotDocument>,
    @InjectModel(Bloque.name)
    private readonly bloqueModel: Model<BloqueDocument>,
    private readonly rankingService: RankingService,
  ) {}

  async listarTorneosPublicos(): Promise<TorneoResumenDto[]> {
    const torneos: any[] = await this.torneoModel
      .find({ publico: true })
      .select('nombre fecha categoria estado fase robotsInscritos')
      .populate('categoria', 'nombre')
      .sort({ fecha: -1 })
      .lean()
      .exec();

    if (torneos.length === 0) return [];

    const torneoIds = torneos.map((torneo) => torneo._id);
    const combates: any[] = await this.combateModel
      .find({ torneo: { $in: torneoIds } })
      .select('torneo estado fase resultado robot1 robot2')
      .populate('robot1', 'nombre')
      .populate('robot2', 'nombre')
      .lean()
      .exec();
    const porTorneo = new Map<string, any[]>();
    for (const combate of combates) {
      const key = String(combate.torneo);
      const actual = porTorneo.get(key) ?? [];
      actual.push(combate);
      porTorneo.set(key, actual);
    }

    return torneos.map((t) => {
      const combatesTorneo = porTorneo.get(String(t._id)) ?? [];
      const final = combatesTorneo.find(
        (combate) =>
          combate.fase === FaseCombate.FINAL &&
          combate.estado === EstadoCombate.FINALIZADO,
      );
      const campeon =
        final?.resultado === ResultadoCombate.GANA_ROBOT_1
          ? nombreDe(final.robot1)
          : final?.resultado === ResultadoCombate.GANA_ROBOT_2
            ? nombreDe(final.robot2)
            : null;

      return {
        id: String(t._id),
        nombre: t.nombre,
        fecha: aISO(t.fecha),
        categoria: t.categoria ? nombreDe(t.categoria) : null,
        estado: t.estado ?? null,
        fase: t.fase ?? null,
        robots: t.robotsInscritos?.length ?? 0,
        combates: combatesTorneo.length,
        combatesEnCurso: combatesTorneo.filter(
          (combate) => combate.estado === EstadoCombate.EN_CURSO,
        ).length,
        combatesPendientes: combatesTorneo.filter(
          (combate) => combate.estado === EstadoCombate.PENDIENTE,
        ).length,
        campeon,
      };
    });
  }

  async armarLive(torneoId: string): Promise<LiveDto | null> {
    const t: any = await this.torneoModel
      .findOne({ _id: torneoId, publico: true })
      .select(
        'nombre fecha categoria estado horaInicio duracionCombateMin participantes robotsInscritos',
      )
      .populate('categoria', 'nombre')
      .lean();
    if (!t) return null;

    // Campos reales del schema Combate: robot1, robot2, resultado (no existen "robots" ni "ganador").
    // Solo se publican nombres: nunca imágenes, jueces ni observaciones.
    const combates: any[] = await this.combateModel
      .find({ torneo: new Types.ObjectId(torneoId) })
      .select(
        'numero fase bloque dojo turno arena estado resultado metodoVictoria otroMetodoVictoria horarioProgramado robot1 robot2 placeholder1 placeholder2',
      )
      .populate('robot1', 'nombre')
      .populate('robot2', 'nombre')
      .populate('dojo', 'nombre')
      .populate('bloque', 'nombre')
      .lean();

    combates.sort(porOrden);
    const numeroPorRobot = new Map<string, number>(
      (t.participantes ?? []).map((participante: any) => [
        String(participante.robot),
        participante.numero,
      ]),
    );
    const [robotsInscritos, bloques] = await Promise.all([
      this.robotModel
        .find({
          _id: {
            $in: (t.robotsInscritos ?? []).map(
              (robot: unknown) => new Types.ObjectId(String(robot)),
            ),
          },
        })
        .select('nombre equipo categoria pesoKg')
        .populate('equipo', 'nombre institucion')
        .populate('categoria', 'nombre')
        .lean()
        .exec(),
      this.bloqueModel
        .find({ torneo: new Types.ObjectId(torneoId) })
        .select('nombre robots')
        .sort({ nombre: 1 })
        .lean()
        .exec(),
    ]);
    const bloquePorRobot = new Map<string, string>();
    for (const bloque of bloques) {
      for (const robot of bloque.robots ?? []) {
        bloquePorRobot.set(String(robot), bloque.nombre);
      }
    }

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
      const robotGanador =
        c.resultado === ResultadoCombate.GANA_ROBOT_1
          ? c.robot1
          : c.resultado === ResultadoCombate.GANA_ROBOT_2
            ? c.robot2
            : null;

      return {
        numero: c.numero,
        fase: c.fase ? nombreDe(c.fase) : null,
        dojo,
        bloque: c.bloque ? nombreDe(c.bloque) : null,
        robots: [
          robot1 || String(c.placeholder1 ?? ''),
          robot2 || String(c.placeholder2 ?? ''),
        ].filter(Boolean),
        robotsDetalle: [
          {
            id: c.robot1?._id ? String(c.robot1._id) : null,
            numero: c.robot1?._id
              ? (numeroPorRobot.get(String(c.robot1._id)) ?? null)
              : null,
            nombre: robot1 || String(c.placeholder1 ?? ''),
          },
          {
            id: c.robot2?._id ? String(c.robot2._id) : null,
            numero: c.robot2?._id
              ? (numeroPorRobot.get(String(c.robot2._id)) ?? null)
              : null,
            nombre: robot2 || String(c.placeholder2 ?? ''),
          },
        ].filter((robot) => robot.nombre),
        estado,
        ganador,
        ganadorNumero: robotGanador?._id
          ? (numeroPorRobot.get(String(robotGanador._id)) ?? null)
          : null,
        metodoVictoria:
          c.metodoVictoria === 'Otro' && c.otroMetodoVictoria
            ? c.otroMetodoVictoria
            : c.metodoVictoria ?? null,
        horarioProgramado: aISO(c.horarioProgramado),
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
    const robots: RobotLiveDto[] = robotsInscritos.map((robot: any) => ({
      id: String(robot._id),
      numero: numeroPorRobot.get(String(robot._id)) ?? null,
      nombre: robot.nombre,
      equipo: robot.equipo?.nombre ?? 'Sin equipo',
      institucion: robot.equipo?.institucion ?? 'Sin institución',
      categoria: robot.categoria?.nombre ?? 'Sin categoría',
      pesoKg: robot.pesoKg ?? null,
      grupo: bloquePorRobot.get(String(robot._id)) ?? null,
    }));
    const rankingPorBloque = await Promise.all(
      bloques.map(async (bloque): Promise<GrupoLiveDto> => {
        const filas = await this.rankingService.calcular(torneoId, {
          bloque: String(bloque._id),
        });
        return {
          nombre: bloque.nombre,
          filas: filas.map((fila) => ({
            robotId: fila.robotId,
            numero: numeroPorRobot.get(fila.robotId) ?? null,
            robot: fila.robotNombre,
            equipo: fila.equipoNombre,
            combates: fila.combates,
            victorias: fila.victorias,
            empates: fila.empates,
            derrotas: fila.derrotas,
            puntos: fila.puntos,
          })),
        };
      }),
    );
    const ganadorDe = (combate: any): any =>
      combate?.resultado === ResultadoCombate.GANA_ROBOT_1
        ? combate.robot1
        : combate?.resultado === ResultadoCombate.GANA_ROBOT_2
          ? combate.robot2
          : null;
    const perdedorDe = (combate: any): any =>
      combate?.resultado === ResultadoCombate.GANA_ROBOT_1
        ? combate.robot2
        : combate?.resultado === ResultadoCombate.GANA_ROBOT_2
          ? combate.robot1
          : null;
    const finalizado = (combate: any): boolean =>
      combate?.estado === EstadoCombate.FINALIZADO;
    const combateFinal = [...combates]
      .reverse()
      .find(
        (combate) =>
          combate.fase === FaseCombate.FINAL &&
          finalizado(combate),
      );
    const combateTercerLugar = [...combates]
      .reverse()
      .find(
        (combate) =>
          combate.fase === FaseCombate.TERCER_LUGAR &&
          finalizado(combate),
      );
    const robotCampeon = ganadorDe(combateFinal);
    const lugarPodio = (robot: any): PodioLugarLiveDto | null =>
      robot?._id
        ? {
            robotId: String(robot._id),
            numero: numeroPorRobot.get(String(robot._id)) ?? null,
            robot: nombreDe(robot),
          }
        : null;
    const campeonPodio = lugarPodio(robotCampeon);
    const subcampeonPodio = lugarPodio(perdedorDe(combateFinal));
    const podio =
      campeonPodio && subcampeonPodio
          ? {
              campeon: campeonPodio,
              subcampeon: subcampeonPodio,
              tercerLugar: lugarPodio(ganadorDe(combateTercerLugar)),
              cuartoLugar: lugarPodio(perdedorDe(combateTercerLugar)),
            }
          : null;

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
        robots: robots.length,
        combates: salida.length,
        combatesEnCurso: salida.filter(
          (combate) => combate.estado === EstadoCombate.EN_CURSO,
        ).length,
        combatesPendientes: salida.filter(
          (combate) => combate.estado === EstadoCombate.PENDIENTE,
        ).length,
        campeon: robotCampeon ? nombreDe(robotCampeon) : null,
      },
      combates: salida,
      robots,
      grupos: rankingPorBloque,
      podio,
      generadoEn: new Date().toISOString(),
    };
  }

  async armarFichaRobot(
    torneoId: string,
    robotId: string,
    soloPublico = true,
  ): Promise<Record<string, unknown> | null> {
    const torneo: any = await this.torneoModel
      .findById(torneoId)
      .select('publico participantes robotsInscritos')
      .lean()
      .exec();
    if (!torneo || (soloPublico && torneo.publico !== true)) return null;

    const registrado =
      (torneo.participantes ?? []).some(
        (item: any) => String(item.robot) === robotId,
      ) ||
      (torneo.robotsInscritos ?? []).some(
        (item: any) => String(item) === robotId,
      );
    if (!registrado) return null;

    const [robot, bloque, combates] = await Promise.all([
      this.robotModel
        .findById(robotId)
        .select('nombre equipo categoria pesoKg')
        .populate('equipo', 'nombre institucion')
        .populate('categoria', 'nombre')
        .lean()
        .exec(),
      this.bloqueModel
        .findOne({
          torneo: new Types.ObjectId(torneoId),
          robots: new Types.ObjectId(robotId),
        })
        .select('nombre')
        .lean()
        .exec(),
      this.combateModel
        .find({
          torneo: new Types.ObjectId(torneoId),
          $or: [
            { robot1: new Types.ObjectId(robotId) },
            { robot2: new Types.ObjectId(robotId) },
          ],
        })
        .select(
          'numero fase estado resultado horarioProgramado robot1 robot2 placeholder1 placeholder2 dojo',
        )
        .populate('robot1', 'nombre')
        .populate('robot2', 'nombre')
        .populate('dojo', 'nombre')
        .lean()
        .exec(),
    ]);
    if (!robot) return null;

    combates.sort(porOrden);
    let victorias = 0;
    let derrotas = 0;
    for (const combate of combates) {
      if (String(combate.estado) !== EstadoCombate.FINALIZADO) continue;
      const esRobot1 = String(combate.robot1?._id ?? combate.robot1) === robotId;
      const ganoRobot1 = combate.resultado === ResultadoCombate.GANA_ROBOT_1;
      const ganoRobot2 = combate.resultado === ResultadoCombate.GANA_ROBOT_2;
      if ((esRobot1 && ganoRobot1) || (!esRobot1 && ganoRobot2)) victorias++;
      else if ((esRobot1 && ganoRobot2) || (!esRobot1 && ganoRobot1)) derrotas++;
    }

    const resumenCombate = (combate: any) => {
      if (!combate) return null;
      const esRobot1 = String(combate.robot1?._id ?? combate.robot1) === robotId;
      const rival = esRobot1
        ? combate.robot2?.nombre ?? combate.placeholder2
        : combate.robot1?.nombre ?? combate.placeholder1;
      return {
        numero: combate.numero,
        fase: combate.fase,
        estado: combate.estado,
        dojo: combate.dojo?.nombre ?? null,
        rival: rival ?? 'Por definir',
        horarioProgramado: aISO(combate.horarioProgramado),
      };
    };

    const participante = (torneo.participantes ?? []).find(
      (item: any) => String(item.robot) === robotId,
    );
    const dojo = combates.find((combate) => combate.dojo)?.dojo;
    const dojoNombre =
      dojo && typeof dojo === 'object' && 'nombre' in dojo
        ? String(dojo.nombre)
        : null;
    const equipo = robot.equipo as any;
    const categoria = robot.categoria as any;

    return {
      torneoId,
      robot: {
        id: String(robot._id),
        nombre: robot.nombre,
        numero: participante?.numero ?? null,
        pesoKg: robot.pesoKg ?? null,
      },
      equipo: {
        nombre: equipo?.nombre ?? 'Sin equipo',
        institucion: equipo?.institucion ?? 'Sin institución',
      },
      categoria: categoria?.nombre ?? 'Sin categoría',
      grupo: bloque?.nombre ?? null,
      dojo: dojoNombre,
      record: { victorias, derrotas },
      ultimoCombate: resumenCombate(
        [...combates]
          .reverse()
          .find(
            (combate) =>
              String(combate.estado) === EstadoCombate.FINALIZADO,
          ),
      ),
      proximoCombate: resumenCombate(
        combates.find(
          (combate) =>
            String(combate.estado) !== EstadoCombate.FINALIZADO,
        ),
      ),
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
    const torneo: any = await this.torneoModel
      .findById(torneoId)
      .select('participantes')
      .lean()
      .exec();
    const numeroPorRobot = new Map<string, number>(
      (torneo?.participantes ?? []).map((participante: any) => [
        String(participante.robot),
        participante.numero,
      ]),
    );

    // Lista blanca: solo expone el ID público del robot; no equipoId ni imágenes.
    return {
      filas: filas.map((f) => ({
        robotId: f.robotId,
        numero: numeroPorRobot.get(f.robotId) ?? null,
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
