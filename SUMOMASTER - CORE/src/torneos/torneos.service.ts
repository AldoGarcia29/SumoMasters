import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { MongoServerError } from 'mongodb';
import { Model, Types } from 'mongoose';
import { CreateTorneoDto } from './dto/create-torneo.dto';
import { UpdateTorneoDto } from './dto/update-torneo.dto';
import { Torneo, TorneoDocument } from './schemas/torneo.schema';
import { PublicCacheService } from '../public/public-cache.service';
import { UpdateHorarioDto } from '../public/dto/update-horario.dto';
import { LISTA_KEY, liveKey } from '../public/public.constants';
import { PublicService } from '../public/public.service';

const POPULATE = [
  { path: 'categoria', select: 'nombre tipoCombate' },
  {
    path: 'robotsInscritos',
    select: 'nombre imagenUrl equipo pesoKg createdAt',
    populate: { path: 'equipo', select: 'nombre' },
  },
  { path: 'participantes.robot', select: 'nombre imagenUrl equipo pesoKg' },
];

@Injectable()
export class TorneosService {
  constructor(
    @InjectModel(Torneo.name)
    private readonly torneoModel: Model<TorneoDocument>,
    private readonly publicCache: PublicCacheService,
    private readonly publicService: PublicService,
  ) {}

  async create(dto: CreateTorneoDto): Promise<TorneoDocument> {
    const torneo = new this.torneoModel({
      ...dto,
      robotsInscritos: [],
      nombre: dto.nombre.trim(),
    });

    try {
      await torneo.save();
      await this.inscribirRobots(torneo.id, dto.robotsInscritos ?? []);
      this.invalidatePublicData(torneo.id);
      const creado = await this.torneoModel
        .findById(torneo.id)
        .populate(POPULATE)
        .exec();
      if (!creado) throw new NotFoundException('Torneo no encontrado');
      return creado;
    } catch (error: unknown) {
      this.handleDuplicateKeyError(error);
      throw error;
    }
  }

  async findAll(filters?: {
    search?: string;
    estado?: string;
    categoria?: string;
  }): Promise<TorneoDocument[]> {
    const query: Record<string, unknown> = {};

    if (filters?.estado) query.estado = filters.estado;
    if (filters?.categoria) query.categoria = filters.categoria;
    if (filters?.search) {
      query.nombre = { $regex: filters.search, $options: 'i' };
    }

    return this.torneoModel
      .find(query)
      .populate(POPULATE)
      .sort({ fecha: -1 })
      .exec();
  }

  async findOne(id: string): Promise<TorneoDocument> {
    const torneo = await this.torneoModel
      .findById(id)
      .populate(POPULATE)
      .exec();

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    return torneo;
  }

  async update(id: string, dto: UpdateTorneoDto): Promise<TorneoDocument> {
    try {
      if (dto.robotsInscritos !== undefined) {
        await this.inscribirRobots(id, dto.robotsInscritos);
      }

      const { robotsInscritos, ...campos } = dto;
      const torneo = await this.torneoModel
        .findByIdAndUpdate(
          id,
          {
            $set: {
              ...campos,
              ...(robotsInscritos !== undefined
                ? { robotsInscritos }
                : {}),
            },
          },
          { new: true, runValidators: true },
        )
        .populate(POPULATE)
        .exec();

      if (!torneo) {
        throw new NotFoundException('Torneo no encontrado');
      }
      if (robotsInscritos !== undefined) this.invalidatePublicData(id);

      return torneo;
    } catch (error: unknown) {
      this.handleDuplicateKeyError(error);
      throw error;
    }
  }

  async fichaRobot(torneoId: string, robotId: string) {
    const ficha = await this.publicService.armarFichaRobot(
      torneoId,
      robotId,
      false,
    );
    if (!ficha) throw new NotFoundException('Robot o torneo no encontrado');
    return ficha;
  }

  private async inscribirRobots(
    torneoId: string,
    robotIds: string[],
  ): Promise<void> {
    const idsUnicos = [...new Set(robotIds)];
    for (const robotId of idsUnicos) {
      const id = new Types.ObjectId(robotId);
      const numero = { $add: [{ $ifNull: ['$ultimoNumero', 0] }, 1] };
      const actualizado = await this.torneoModel.findOneAndUpdate(
        {
          _id: torneoId,
          'participantes.robot': { $ne: id },
        },
        [
          {
            $set: {
              ultimoNumero: numero,
              robotsInscritos: {
                $setUnion: [{ $ifNull: ['$robotsInscritos', []] }, [id]],
              },
              participantes: {
                $concatArrays: [
                  { $ifNull: ['$participantes', []] },
                  [{ robot: id, numero }],
                ],
              },
            },
          },
        ],
        { returnDocument: 'after', updatePipeline: true },
      );

      if (actualizado) continue;

      const torneo = await this.torneoModel
        .findById(torneoId)
        .select('_id participantes')
        .lean()
        .exec();
      if (!torneo) throw new NotFoundException('Torneo no encontrado');
      if (!torneo.participantes?.some((p) => p.robot.equals(id))) {
        throw new ConflictException(
          `No se pudo asignar número al robot ${robotId}`,
        );
      }
    }
  }

  private invalidatePublicData(torneoId: string): void {
    this.publicCache.invalidate(liveKey(torneoId));
    this.publicCache.invalidate(LISTA_KEY);
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const result = await this.torneoModel.findByIdAndDelete(id).exec();

    if (!result) {
      throw new NotFoundException('Torneo no encontrado');
    }

    return { deleted: true };
  }

  private handleDuplicateKeyError(error: unknown): void {
    if (error instanceof MongoServerError && error.code === 11000) {
      throw new ConflictException('Ya existe un torneo con ese nombre');
    }
  }

  async actualizarHorario(id: string, dto: UpdateHorarioDto) {
    const update: Record<string, unknown> = {};
    if (dto.horaInicio !== undefined) {
      update.horaInicio =
        dto.horaInicio === null ? null : new Date(dto.horaInicio);
    }
    if (dto.duracionCombateMin !== undefined) {
      update.duracionCombateMin = dto.duracionCombateMin;
    }
    if (Object.keys(update).length === 0) {
      throw new BadRequestException('Nada que actualizar');
    }

    const t = await this.torneoModel.findByIdAndUpdate(id, update, {
      new: true,
    });
    if (!t) throw new NotFoundException('Torneo no encontrado');

    this.publicCache.invalidate(liveKey(id)); // el público ve el cambio al instante
    return {
      horaInicio: t.horaInicio,
      duracionCombateMin: t.duracionCombateMin,
    };
  }

  async cambiarVisibilidad(id: string, publico: boolean) {
    const t = await this.torneoModel.findByIdAndUpdate(
      id,
      { publico },
      { new: true },
    );
    if (!t) throw new NotFoundException('Torneo no encontrado');

    this.publicCache.invalidate(liveKey(id));
    this.publicCache.invalidate(LISTA_KEY);
    return { publico: t.publico };
  }
}
