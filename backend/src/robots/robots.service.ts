import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  Robot,
  RobotDocument,
} from './schemas/robot.schema';
import {
  Equipo,
  EquipoDocument,
} from '../equipos/schemas/equipo.schema';
import { CreateRobotDto } from './dto/create-robot.dto';
import { UpdateRobotDto } from './dto/update-robot.dto';

@Injectable()
export class RobotsService {
  constructor(
    @InjectModel(Robot.name)
    private readonly robotModel: Model<RobotDocument>,

    @InjectModel(Equipo.name)
    private readonly equipoModel: Model<EquipoDocument>,
  ) {}

  async create(createRobotDto: CreateRobotDto) {
    this.validarObjectId(createRobotDto.equipoId);
    this.validarObjectId(createRobotDto.categoriaId);

    const equipo = await this.equipoModel
      .findById(createRobotDto.equipoId)
      .exec();

    if (!equipo) {
      throw new NotFoundException(
        `No existe el equipo con ID ${createRobotDto.equipoId}`,
      );
    }

    const fuerzaNeta =
      createRobotDto.fuerza - createRobotDto.peso;

    if (fuerzaNeta < 0) {
      throw new BadRequestException(
        'La fuerza neta no puede ser negativa',
      );
    }

    const nuevoRobot = await this.robotModel.create({
      ...createRobotDto,
      equipoId: new Types.ObjectId(createRobotDto.equipoId),
      categoriaId: new Types.ObjectId(
        createRobotDto.categoriaId,
      ),
      fuerzaNeta,
    });

    await this.equipoModel.findByIdAndUpdate(
      createRobotDto.equipoId,
      {
        $addToSet: {
          robotIds: nuevoRobot._id,
        },
      },
    );

    return nuevoRobot;
  }

  async findAll() {
    return this.robotModel
      .find()
      .populate('equipoId', 'nombreEquipo institucion')
      .exec();
  }

  async findOne(id: string) {
    this.validarObjectId(id);

    const robot = await this.robotModel
      .findById(id)
      .populate('equipoId', 'nombreEquipo institucion')
      .exec();

    if (!robot) {
      throw new NotFoundException(
        `No existe el robot con ID ${id}`,
      );
    }

    return robot;
  }

  async findByEquipo(equipoId: string) {
    this.validarObjectId(equipoId);

    return this.robotModel
      .find({
        equipoId: new Types.ObjectId(equipoId),
      })
      .exec();
  }

  async update(
    id: string,
    updateRobotDto: UpdateRobotDto,
  ) {
    this.validarObjectId(id);

    const robotActual = await this.robotModel
      .findById(id)
      .exec();

    if (!robotActual) {
      throw new NotFoundException(
        `No existe el robot con ID ${id}`,
      );
    }

    const datos: Record<string, unknown> = {
      ...updateRobotDto,
    };

    if (updateRobotDto.equipoId) {
      this.validarObjectId(updateRobotDto.equipoId);

      const nuevoEquipo = await this.equipoModel
        .findById(updateRobotDto.equipoId)
        .exec();

      if (!nuevoEquipo) {
        throw new NotFoundException(
          `No existe el equipo con ID ${updateRobotDto.equipoId}`,
        );
      }

      datos.equipoId = new Types.ObjectId(
        updateRobotDto.equipoId,
      );
    }

    if (updateRobotDto.categoriaId) {
      this.validarObjectId(updateRobotDto.categoriaId);

      datos.categoriaId = new Types.ObjectId(
        updateRobotDto.categoriaId,
      );
    }

    const peso =
      updateRobotDto.peso ?? robotActual.peso;

    const fuerza =
      updateRobotDto.fuerza ?? robotActual.fuerza;

    datos.fuerzaNeta = fuerza - peso;

    const equipoAnteriorId =
      robotActual.equipoId.toString();

    const robotActualizado = await this.robotModel
      .findByIdAndUpdate(id, datos, {
        new: true,
        runValidators: true,
      })
      .exec();

    if (
      updateRobotDto.equipoId &&
      updateRobotDto.equipoId !== equipoAnteriorId
    ) {
      await this.equipoModel.findByIdAndUpdate(
        equipoAnteriorId,
        {
          $pull: {
            robotIds: robotActual._id,
          },
        },
      );

      await this.equipoModel.findByIdAndUpdate(
        updateRobotDto.equipoId,
        {
          $addToSet: {
            robotIds: robotActual._id,
          },
        },
      );
    }

    return robotActualizado;
  }

  async remove(id: string) {
    this.validarObjectId(id);

    const robot = await this.robotModel
      .findByIdAndDelete(id)
      .exec();

    if (!robot) {
      throw new NotFoundException(
        `No existe el robot con ID ${id}`,
      );
    }

    await this.equipoModel.findByIdAndUpdate(
      robot.equipoId,
      {
        $pull: {
          robotIds: robot._id,
        },
      },
    );

    return {
      mensaje: 'Robot eliminado correctamente',
      robot,
    };
  }

  private validarObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(
        `El ID ${id} no es válido`,
      );
    }
  }
}