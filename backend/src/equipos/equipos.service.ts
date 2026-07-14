import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  Equipo,
  EquipoDocument,
} from './schemas/equipo.schema';
import { CreateEquipoDto } from './dto/create-equipo.dto';
import { UpdateEquipoDto } from './dto/update-equipo.dto';

@Injectable()
export class EquiposService {
  constructor(
    @InjectModel(Equipo.name)
    private readonly equipoModel: Model<EquipoDocument>,
  ) {}

  async create(createEquipoDto: CreateEquipoDto) {
    const nuevoEquipo = new this.equipoModel({
      ...createEquipoDto,

      categoriaId: new Types.ObjectId(
        createEquipoDto.categoriaId,
      ),

      torneoId: new Types.ObjectId(
        createEquipoDto.torneoId,
      ),

      robotIds: [],
    });

    return nuevoEquipo.save();
  }

  async findAll() {
    return this.equipoModel.find().exec();
  }

  async findOne(id: string) {
    this.validarObjectId(id);

    const equipo = await this.equipoModel.findById(id).exec();

    if (!equipo) {
      throw new NotFoundException(
        `No existe el equipo con ID ${id}`,
      );
    }

    return equipo;
  }

  async update(
    id: string,
    updateEquipoDto: UpdateEquipoDto,
  ) {
    this.validarObjectId(id);

    const datos: Record<string, unknown> = {
      ...updateEquipoDto,
    };

    if (updateEquipoDto.categoriaId) {
      datos.categoriaId = new Types.ObjectId(
        updateEquipoDto.categoriaId,
      );
    }

    if (updateEquipoDto.torneoId) {
      datos.torneoId = new Types.ObjectId(
        updateEquipoDto.torneoId,
      );
    }

    const equipo = await this.equipoModel
      .findByIdAndUpdate(id, datos, {
        new: true,
        runValidators: true,
      })
      .exec();

    if (!equipo) {
      throw new NotFoundException(
        `No existe el equipo con ID ${id}`,
      );
    }

    return equipo;
  }

  async remove(id: string) {
    this.validarObjectId(id);

    const equipo = await this.equipoModel
      .findByIdAndDelete(id)
      .exec();

    if (!equipo) {
      throw new NotFoundException(
        `No existe el equipo con ID ${id}`,
      );
    }

    return {
      mensaje: 'Equipo eliminado correctamente',
      equipo,
    };
  }

  private validarObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(
        `El ID ${id} no es válido`,
      );
    }
  }
}