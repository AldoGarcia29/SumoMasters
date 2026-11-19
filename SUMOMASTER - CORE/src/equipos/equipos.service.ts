import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { MongoServerError } from 'mongodb';
import { Model } from 'mongoose';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateEquipoDto } from './dto/create-equipo.dto';
import { UpdateEquipoDto } from './dto/update-equipo.dto';
import { Equipo, EquipoDocument } from './schemas/equipo.schema';

const CATEGORIA_POPULATE = { path: 'categoria', select: 'nombre tipoCombate' };

@Injectable()
export class EquiposService {
  constructor(
    @InjectModel(Equipo.name)
    private readonly equipoModel: Model<EquipoDocument>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(dto: CreateEquipoDto): Promise<EquipoDocument> {
    const createPayload = { ...dto };
    if (dto.logoUrl?.startsWith('data:image')) {
      const uploadResult = await this.cloudinaryService.uploadBase64(
        dto.logoUrl,
        'sumomaster_teams',
      );
      createPayload.logoUrl = uploadResult?.secure_url ?? '';
    }

    const equipo = new this.equipoModel({
      ...createPayload,
      nombre: dto.nombre.trim(),
      logoIniciales: dto.logoIniciales || this.buildInitials(dto.nombre),
    });

    try {
      await equipo.save();
      return equipo.populate(CATEGORIA_POPULATE);
    } catch (error: unknown) {
      this.handleDuplicateKeyError(error);
      throw error;
    }
  }

  async findAll(filters?: {
    search?: string;
    categoria?: string;
  }): Promise<EquipoDocument[]> {
    const query: Record<string, unknown> = {};

    if (filters?.categoria) {
      query.categoria = filters.categoria;
    }

    if (filters?.search) {
      query.$or = [
        { nombre: { $regex: filters.search, $options: 'i' } },
        { institucion: { $regex: filters.search, $options: 'i' } },
      ];
    }

    return this.equipoModel
      .find(query)
      .populate(CATEGORIA_POPULATE)
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<EquipoDocument> {
    const equipo = await this.equipoModel
      .findById(id)
      .populate(CATEGORIA_POPULATE)
      .exec();

    if (!equipo) {
      throw new NotFoundException('Equipo no encontrado');
    }

    return equipo;
  }

  async update(id: string, dto: UpdateEquipoDto): Promise<EquipoDocument> {
    const updatePayload = { ...dto };
    if (dto.logoUrl?.startsWith('data:image')) {
      const uploadResult = await this.cloudinaryService.uploadBase64(
        dto.logoUrl,
        'sumomaster_teams',
      );
      if (uploadResult) {
        updatePayload.logoUrl = uploadResult.secure_url;
      } else {
        delete updatePayload.logoUrl;
      }
    }

    try {
      const equipo = await this.equipoModel
        .findByIdAndUpdate(
          id,
          { $set: updatePayload },
          { new: true, runValidators: true },
        )
        .populate(CATEGORIA_POPULATE)
        .exec();

      if (!equipo) {
        throw new NotFoundException('Equipo no encontrado');
      }

      return equipo;
    } catch (error: unknown) {
      this.handleDuplicateKeyError(error);
      throw error;
    }
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const result = await this.equipoModel.findByIdAndDelete(id).exec();

    if (!result) {
      throw new NotFoundException('Equipo no encontrado');
    }

    return { deleted: true };
  }

  /** Usado por el módulo de Robots para mantener sincronizado el contador. */
  async incrementRobotsCount(id: string, delta: number): Promise<void> {
    await this.equipoModel
      .findByIdAndUpdate(id, { $inc: { robotsCount: delta } })
      .exec();
  }

  private buildInitials(nombre: string): string {
    const parts = nombre.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const second = parts.length > 1 ? parts[1][0] : '';
    return (first + second).toUpperCase();
  }

  private handleDuplicateKeyError(error: unknown): void {
    if (error instanceof MongoServerError && error.code === 11000) {
      throw new ConflictException('Ya existe un equipo con ese nombre');
    }
  }
}
