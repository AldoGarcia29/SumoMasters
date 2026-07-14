import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  Categoria,
  CategoriaDocument,
  EstadoCategoria,
} from './schemas/categoria.schema';

import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';

@Injectable()
export class CategoriasService {
  constructor(
    @InjectModel(Categoria.name)
    private readonly categoriaModel: Model<CategoriaDocument>,
  ) {}

  async create(createCategoriaDto: CreateCategoriaDto) {
    const categoriaExistente = await this.categoriaModel
      .findOne({
        nombre: {
          $regex: `^${this.escaparRegex(
            createCategoriaDto.nombre.trim(),
          )}$`,
          $options: 'i',
        },
      })
      .exec();

    if (categoriaExistente) {
      throw new ConflictException(
        `Ya existe una categoría llamada ${createCategoriaDto.nombre}`,
      );
    }

    return this.categoriaModel.create({
      ...createCategoriaDto,
      nombre: createCategoriaDto.nombre.trim(),
      descripcion: createCategoriaDto.descripcion.trim(),
      reglas: createCategoriaDto.reglas.trim(),
    });
  }

  async findAll() {
    return this.categoriaModel
      .find()
      .sort({ nombre: 1 })
      .exec();
  }

  async findActivas() {
  return this.categoriaModel
    .find({
      estado: EstadoCategoria.ACTIVA,
    })
    .sort({ nombre: 1 })
    .exec();
}
  async findOne(id: string) {
    this.validarObjectId(id);

    const categoria = await this.categoriaModel
      .findById(id)
      .exec();

    if (!categoria) {
      throw new NotFoundException(
        `No existe la categoría con ID ${id}`,
      );
    }

    return categoria;
  }

  async update(
    id: string,
    updateCategoriaDto: UpdateCategoriaDto,
  ) {
    this.validarObjectId(id);

    if (updateCategoriaDto.nombre) {
      const categoriaDuplicada = await this.categoriaModel
        .findOne({
          _id: { $ne: new Types.ObjectId(id) },
          nombre: {
            $regex: `^${this.escaparRegex(
              updateCategoriaDto.nombre.trim(),
            )}$`,
            $options: 'i',
          },
        })
        .exec();

      if (categoriaDuplicada) {
        throw new ConflictException(
          `Ya existe una categoría llamada ${updateCategoriaDto.nombre}`,
        );
      }
    }

    const categoria = await this.categoriaModel
      .findByIdAndUpdate(
        id,
        {
          ...updateCategoriaDto,
          ...(updateCategoriaDto.nombre && {
            nombre: updateCategoriaDto.nombre.trim(),
          }),
          ...(updateCategoriaDto.descripcion && {
            descripcion:
              updateCategoriaDto.descripcion.trim(),
          }),
          ...(updateCategoriaDto.reglas && {
            reglas: updateCategoriaDto.reglas.trim(),
          }),
        },
        {
          new: true,
          runValidators: true,
        },
      )
      .exec();

    if (!categoria) {
      throw new NotFoundException(
        `No existe la categoría con ID ${id}`,
      );
    }

    return categoria;
  }

  async remove(id: string) {
    this.validarObjectId(id);

    const categoria = await this.categoriaModel
      .findByIdAndDelete(id)
      .exec();

    if (!categoria) {
      throw new NotFoundException(
        `No existe la categoría con ID ${id}`,
      );
    }

    return {
      mensaje: 'Categoría eliminada correctamente',
      categoria,
    };
  }

  private validarObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(
        `El ID ${id} no es válido`,
      );
    }
  }

  private escaparRegex(texto: string): string {
    return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}