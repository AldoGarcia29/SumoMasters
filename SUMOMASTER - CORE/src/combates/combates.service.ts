import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bloque, BloqueDocument } from '../bloques/schemas/bloque.schema';
import { Dojo, DojoDocument } from '../dojos/schemas/dojo.schema';
import { EstadoCombate, FaseCombate } from './enums/combate.enums';
import { EstadoDojo } from '../dojos/enums/estado-dojo.enum';
import { AsignarDojoDto } from './dto/asignar-dojo.dto';
import { GenerarCombatesDto } from './dto/generar-combates.dto';
import { RegistrarResultadoDto } from './dto/registrar-resultado.dto';
import { Combate, CombateDocument } from './schemas/combate.schema';

const POPULATE = [
  { path: 'robot1', select: 'nombre equipo', populate: { path: 'equipo', select: 'nombre' } },
  { path: 'robot2', select: 'nombre equipo', populate: { path: 'equipo', select: 'nombre' } },
  { path: 'dojo', select: 'nombre estado' },
  { path: 'bloque', select: 'nombre' },
];

@Injectable()
export class CombatesService {
  constructor(
    @InjectModel(Combate.name) private readonly combateModel: Model<CombateDocument>,
    @InjectModel(Bloque.name) private readonly bloqueModel: Model<BloqueDocument>,
    @InjectModel(Dojo.name) private readonly dojoModel: Model<DojoDocument>,
  ) {}

  async findByTorneo(
    torneoId: string,
    filters?: { bloque?: string; dojo?: string; estado?: string; fase?: string },
  ): Promise<CombateDocument[]> {
    const query: Record<string, unknown> = { torneo: torneoId };

    if (filters?.bloque) query.bloque = filters.bloque;
    if (filters?.dojo) query.dojo = filters.dojo;
    if (filters?.estado) query.estado = filters.estado;
    if (filters?.fase) query.fase = filters.fase;

    return this.combateModel
      .find(query)
      .populate(POPULATE)
      .sort({ bloque: 1, numero: 1 })
      .exec();
  }

  async findOne(id: string): Promise<CombateDocument> {
    const combate = await this.combateModel.findById(id).populate(POPULATE).exec();
    if (!combate) throw new NotFoundException('Combate no encontrado');
    return combate;
  }

  /** Genera los enfrentamientos round-robin (todos contra todos) de uno o todos los bloques del torneo. */
  async generar(torneoId: string, dto: GenerarCombatesDto): Promise<CombateDocument[]> {
    const fase = dto.fase ?? FaseCombate.FASE_GRUPOS;

    const bloques = dto.bloqueId
      ? await this.bloqueModel.find({ _id: dto.bloqueId, torneo: torneoId }).exec()
      : await this.bloqueModel.find({ torneo: torneoId }).exec();

    if (bloques.length === 0) {
      throw new BadRequestException(
        'No hay bloques generados para este torneo. Genera los bloques primero.',
      );
    }

    const bloqueIds = bloques.map((b) => b._id);
    await this.combateModel
      .deleteMany({ torneo: torneoId, bloque: { $in: bloqueIds }, fase })
      .exec();

    const documentos: Record<string, unknown>[] = [];

    for (const bloque of bloques) {
      const robots = bloque.robots as Types.ObjectId[];
      let numero = 1;

      for (let i = 0; i < robots.length; i++) {
        for (let j = i + 1; j < robots.length; j++) {
          documentos.push({
            torneo: new Types.ObjectId(torneoId),
            bloque: bloque._id,
            fase,
            numero: numero++,
            robot1: robots[i],
            robot2: robots[j],
            estado: EstadoCombate.PENDIENTE,
          });
        }
      }
    }

    if (documentos.length === 0) {
      throw new BadRequestException(
        'Los bloques no tienen suficientes robots para generar enfrentamientos.',
      );
    }

    const creados = await this.combateModel.insertMany(documentos);
    const ids: Types.ObjectId[] = creados.map((c) => c._id as Types.ObjectId);
    return this.combateModel.find({ _id: { $in: ids } }).populate(POPULATE).sort({ bloque: 1, numero: 1 }).exec();
  }

  /** Resumen de ocupación de cada dojo dentro de un torneo (para la pantalla de asignación). */
  async resumenDojos(torneoId: string): Promise<
    { dojo: DojoDocument; combatesAsignados: number }[]
  > {
    const dojos = await this.dojoModel.find().sort({ nombre: 1 }).exec();

    const resultados = await Promise.all(
      dojos.map(async (dojo) => {
        const combatesAsignados = await this.combateModel
          .countDocuments({
            torneo: torneoId,
            dojo: dojo._id,
            estado: { $ne: EstadoCombate.FINALIZADO },
          })
          .exec();
        return { dojo, combatesAsignados };
      }),
    );

    return resultados;
  }

  async asignarDojo(id: string, dto: AsignarDojoDto): Promise<CombateDocument> {
    const dojo = await this.dojoModel.findById(dto.dojo).exec();
    if (!dojo) throw new NotFoundException('Dojo no encontrado');

    const combate = await this.combateModel.findById(id).exec();
    if (!combate) throw new NotFoundException('Combate no encontrado');

    const ocupados = await this.combateModel
      .countDocuments({
        dojo: dojo._id,
        estado: { $ne: EstadoCombate.FINALIZADO },
        _id: { $ne: combate._id },
      })
      .exec();

    if (ocupados >= dojo.capacidad) {
      throw new BadRequestException(
        `El dojo "${dojo.nombre}" ya alcanzó su capacidad máxima (${dojo.capacidad} combates).`,
      );
    }

    combate.dojo = dojo._id as unknown as Types.ObjectId;
    await combate.save();

    return this.combateModel.findById(id).populate(POPULATE).exec() as Promise<CombateDocument>;
  }

  async quitarDojo(id: string): Promise<CombateDocument> {
    const combate = await this.combateModel
      .findByIdAndUpdate(id, { $set: { dojo: null } }, { new: true })
      .populate(POPULATE)
      .exec();

    if (!combate) throw new NotFoundException('Combate no encontrado');
    return combate;
  }

  /** Reparte automáticamente los combates pendientes sin dojo entre los dojos disponibles, respetando su capacidad. */
  async asignarDojosAutomatico(torneoId: string, fase?: string): Promise<CombateDocument[]> {
    const query: Record<string, unknown> = { torneo: torneoId, dojo: null };
    if (fase) query.fase = fase;

    const pendientes = await this.combateModel.find(query).sort({ numero: 1 }).exec();
    const dojos = await this.dojoModel
      .find({ estado: { $ne: EstadoDojo.MANTENIMIENTO } })
      .sort({ nombre: 1 })
      .exec();

    if (dojos.length === 0) {
      throw new BadRequestException('No hay dojos disponibles para asignar.');
    }

    const ocupacion = new Map<string, number>();
    for (const dojo of dojos) {
      const actuales = await this.combateModel
        .countDocuments({ dojo: dojo._id, estado: { $ne: EstadoCombate.FINALIZADO } })
        .exec();
      ocupacion.set(dojo.id, actuales);
    }

    const actualizados: Types.ObjectId[] = [];

    for (const combate of pendientes) {
      const disponible = dojos.find(
        (d) => (ocupacion.get(d.id) ?? 0) < d.capacidad,
      );
      if (!disponible) break;

      combate.dojo = disponible._id as unknown as Types.ObjectId;
      await combate.save();
      ocupacion.set(disponible.id, (ocupacion.get(disponible.id) ?? 0) + 1);
      actualizados.push(combate._id as Types.ObjectId);
    }

    return this.combateModel
      .find({ _id: { $in: actualizados } })
      .populate(POPULATE)
      .sort({ numero: 1 })
      .exec();
  }

  async iniciar(id: string): Promise<CombateDocument> {
    const combate = await this.combateModel.findById(id).exec();
    if (!combate) throw new NotFoundException('Combate no encontrado');

    if (combate.estado === EstadoCombate.FINALIZADO) {
      throw new BadRequestException('Este combate ya fue finalizado');
    }

    combate.estado = EstadoCombate.EN_CURSO;
    combate.historial.push({
      hora: new Date(),
      descripcion: 'Combate iniciado',
      tipo: 'info',
    });
    await combate.save();

    return this.combateModel.findById(id).populate(POPULATE).exec() as Promise<CombateDocument>;
  }

  async registrarResultado(id: string, dto: RegistrarResultadoDto): Promise<CombateDocument> {
    const combate = await this.combateModel.findById(id).exec();
    if (!combate) throw new NotFoundException('Combate no encontrado');

    if (combate.estado === EstadoCombate.FINALIZADO) {
      throw new BadRequestException(
        'Este combate ya fue registrado y no puede modificarse.',
      );
    }

    combate.resultado = dto.resultado;
    combate.metodoVictoria = dto.metodoVictoria ?? null;
    combate.duracionSegundos = dto.duracionSegundos ?? null;
    combate.jueces = dto.jueces ?? [];
    combate.observaciones = dto.observaciones ?? '';
    combate.estado = EstadoCombate.FINALIZADO;
    combate.historial.push({
      hora: new Date(),
      descripcion: `Combate finalizado — ${dto.resultado}`,
      tipo: 'success',
    });

    await combate.save();

    return this.combateModel.findById(id).populate(POPULATE).exec() as Promise<CombateDocument>;
  }

  async cancelar(id: string): Promise<CombateDocument> {
    const combate = await this.combateModel.findById(id).exec();
    if (!combate) throw new NotFoundException('Combate no encontrado');

    combate.estado = EstadoCombate.PENDIENTE;
    combate.resultado = null;
    combate.metodoVictoria = null;
    combate.duracionSegundos = null;
    combate.historial.push({
      hora: new Date(),
      descripcion: 'Combate cancelado y reiniciado a pendiente',
      tipo: 'warning',
    });
    await combate.save();

    return this.combateModel.findById(id).populate(POPULATE).exec() as Promise<CombateDocument>;
  }

  /** Conteo global (todos los torneos) para las tarjetas del dashboard. */
  async statsGlobal(): Promise<{ total: number; finalizados: number }> {
    const [total, finalizados] = await Promise.all([
      this.combateModel.countDocuments().exec(),
      this.combateModel.countDocuments({ estado: EstadoCombate.FINALIZADO }).exec(),
    ]);

    return { total, finalizados };
  }
}
