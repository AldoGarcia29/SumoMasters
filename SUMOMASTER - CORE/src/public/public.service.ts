import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

// AJUSTA estas 2 rutas y nombres a tus schemas reales
import { Torneo, TorneoDocument } from '../torneos/schemas/torneo.schema';
import { Combate, CombateDocument } from '../combates/schemas/combate.schema';

import { EstadoCombate } from './enums/estado-combate.enum';
import { DURACION_COMBATE_DEFAULT_MIN } from './public.constants';
import { CombateLiveDto, LiveDto, TorneoResumenDto } from './dto/live.dto';

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

@Injectable()
export class PublicService {
  constructor(
    @InjectModel(Torneo.name) private readonly torneoModel: Model<TorneoDocument>,
    @InjectModel(Combate.name) private readonly combateModel: Model<CombateDocument>,
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
      .select('nombre fecha categoria estado fase horaInicio duracionCombateMin') // AJUSTA
      .lean();
    if (!t) return null;

    const combates: any[] = await this.combateModel
      .find({ torneo: torneoId })                 // AJUSTA: campo del Combate que apunta al torneo
      .select('numero fase robots dojo estado ganador') // sin jueces ni observaciones
      .populate('robots', 'nombre')               // solo el nombre, NUNCA imágenes
      .populate('dojo', 'nombre')                 // quita esta línea si dojo es string/número
      .populate('ganador', 'nombre')              // quita si no existe o no es referencia
      .lean();

    const durMin = t.duracionCombateMin ?? DURACION_COMBATE_DEFAULT_MIN;
    const durMs = durMin * 60_000;
    const inicio = t.horaInicio ? new Date(t.horaInicio).getTime() : null;

    // Cada dojo tiene su propia cola
    const porDojo = new Map<string, any[]>();
    for (const c of combates) {
      const k = nombreDe(c.dojo);
      if (!porDojo.has(k)) porDojo.set(k, []);
      porDojo.get(k)!.push(c);
    }

    const salida: CombateLiveDto[] = [];
    for (const [dojo, cola] of porDojo) {
      cola.sort((a, b) => a.numero - b.numero);
      let pendientes = 0;

      for (const c of cola) {
        const estado = String(c.estado);
        const terminado = estado === EstadoCombate.FINALIZADO;

        salida.push({
          numero: c.numero,
          fase: c.fase ? nombreDe(c.fase) : null,
          dojo,
          robots: (c.robots ?? []).map(nombreDe),
          estado,
          ganador: c.ganador ? nombreDe(c.ganador) : null,
          combatesAntes: terminado ? null : pendientes,
          horaEstimada:
            terminado || inicio === null
              ? null
              : new Date(Math.max(Date.now(), inicio) + pendientes * durMs).toISOString(),
        });

        if (!terminado) pendientes++;
      }
    }

    salida.sort((a, b) => a.numero - b.numero);

    return {
      torneo: {
        id: String(t._id),
        nombre: t.nombre,
        fecha: aISO(t.fecha),
        categoria: t.categoria ? nombreDe(t.categoria) : null,
        estado: t.estado ?? null,
        fase: t.fase ?? null,
        horaInicio: aISO(t.horaInicio),
        duracionCombateMin: durMin,
      },
      combates: salida,
      generadoEn: new Date().toISOString(),
    };
  }
}
