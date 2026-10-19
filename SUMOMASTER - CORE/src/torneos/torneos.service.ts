import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { MongoServerError } from 'mongodb';
import { Model } from 'mongoose';
import { CreateTorneoDto } from './dto/create-torneo.dto';
import { UpdateTorneoDto } from './dto/update-torneo.dto';
import { Torneo, TorneoDocument } from './schemas/torneo.schema';
import { PublicCacheService } from '../public/public-cache.service';
import { UpdateHorarioDto } from '../public/dto/update-horario.dto';
import { LISTA_KEY, liveKey } from '../public/public.constants';

const POPULATE = [
  { path: 'categoria', select: 'nombre tipoCombate' },
  {
    path: 'robotsInscritos',
    select: 'nombre imagenUrl equipo',
    populate: { path: 'equipo', select: 'nombre' },
  },
];

@Injectable()
export class TorneosService {
  constructor(
    @InjectModel(Torneo.name)
    private readonly torneoModel: Model<TorneoDocument>,
    // SE CORRIGIÓ: Se inyecta el servicio para poder usar this.publicCache
    private readonly publicCache: PublicCacheService,
  ) {}

  async create(dto: CreateTorneoDto): Promise<TorneoDocument> {
    const torneo = new this.torneoModel({
      ...dto,
      nombre: dto.nombre.trim(),
    });

    try {
      await torneo.save();
      return torneo.populate(POPULATE);
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
      const torneo = await this.torneoModel
        .findByIdAndUpdate(
          id,
          { $set: dto },
          { new: true, runValidators: true },
        )
        .populate(POPULATE)
        .exec();

      if (!torneo) {
        throw new NotFoundException('Torneo no encontrado');
      }

      return torneo;
    } catch (error: unknown) {
      this.handleDuplicateKeyError(error);
      throw error;
    }
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
