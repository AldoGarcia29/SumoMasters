import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { MongoServerError } from 'mongodb';
import { Model } from 'mongoose';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { Categoria, CategoriaDocument } from './schemas/categoria.schema';

@Injectable()
export class CategoriasService {
  constructor(
    @InjectModel(Categoria.name)
    private readonly categoriaModel: Model<CategoriaDocument>,
  ) {}

  async create(dto: CreateCategoriaDto): Promise<CategoriaDocument> {
    const categoria = new this.categoriaModel({
      ...dto,
      nombre: dto.nombre.trim(),
      pesoMaximoKg: dto.pesoMaximoKg ?? null,
    });

    try {
      return await categoria.save();
    } catch (error: unknown) {
      this.handleDuplicateKeyError(error);
      throw error;
    }
  }

  async findAll(filters?: {
    search?: string;
    estado?: string;
  }): Promise<CategoriaDocument[]> {
    const query: Record<string, unknown> = {};

    if (filters?.estado) {
      query.estado = filters.estado;
    }

    if (filters?.search) {
      query.nombre = { $regex: filters.search, $options: 'i' };
    }

    return this.categoriaModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<CategoriaDocument> {
    const categoria = await this.categoriaModel.findById(id).exec();

    if (!categoria) {
      throw new NotFoundException('Categoría no encontrada');
    }

    return categoria;
  }

  async update(
    id: string,
    dto: UpdateCategoriaDto,
  ): Promise<CategoriaDocument> {
    try {
      const categoria = await this.categoriaModel
        .findByIdAndUpdate(
          id,
          { $set: dto },
          { new: true, runValidators: true },
        )
        .exec();

      if (!categoria) {
        throw new NotFoundException('Categoría no encontrada');
      }

      return categoria;
    } catch (error: unknown) {
      this.handleDuplicateKeyError(error);
      throw error;
    }
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const result = await this.categoriaModel.findByIdAndDelete(id).exec();

    if (!result) {
      throw new NotFoundException('Categoría no encontrada');
    }

    return { deleted: true };
  }

  private handleDuplicateKeyError(error: unknown): void {
    if (error instanceof MongoServerError && error.code === 11000) {
      throw new ConflictException('Ya existe una categoría con ese nombre');
    }
  }
}
