import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EquiposService } from '../equipos/equipos.service';
import { CreateRobotDto } from './dto/create-robot.dto';
import { UpdateRobotDto } from './dto/update-robot.dto';
import { Robot, RobotDocument } from './schemas/robot.schema';

const POPULATE = [
  { path: 'equipo', select: 'nombre institucion' },
  { path: 'categoria', select: 'nombre tipoCombate' },
];

@Injectable()
export class RobotsService {
  constructor(
    @InjectModel(Robot.name) private readonly robotModel: Model<RobotDocument>,
    private readonly equiposService: EquiposService,
  ) {}

  async create(dto: CreateRobotDto): Promise<RobotDocument> {
    const robot = new this.robotModel({
      ...dto,
      nombre: dto.nombre.trim(),
      pesoKg: dto.pesoKg ?? null,
    });

    await robot.save();
    await this.equiposService.incrementRobotsCount(dto.equipo, 1);

    return robot.populate(POPULATE);
  }

  async findAll(filters?: {
    search?: string;
    equipo?: string;
    categoria?: string;
    estado?: string;
  }): Promise<RobotDocument[]> {
    const query: Record<string, unknown> = {};

    if (filters?.equipo) query.equipo = filters.equipo;
    if (filters?.categoria) query.categoria = filters.categoria;
    if (filters?.estado) query.estado = filters.estado;
    if (filters?.search) {
      query.nombre = { $regex: filters.search, $options: 'i' };
    }

    return this.robotModel
      .find(query)
      .populate(POPULATE)
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<RobotDocument> {
    const robot = await this.robotModel.findById(id).populate(POPULATE).exec();

    if (!robot) {
      throw new NotFoundException('Robot no encontrado');
    }

    return robot;
  }

  async update(id: string, dto: UpdateRobotDto): Promise<RobotDocument> {
    const existing = await this.robotModel.findById(id).exec();

    if (!existing) {
      throw new NotFoundException('Robot no encontrado');
    }

    const previousEquipo = existing.equipo.toString();

    const robot = await this.robotModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true, runValidators: true })
      .populate(POPULATE)
      .exec();

    if (!robot) {
      throw new NotFoundException('Robot no encontrado');
    }

    // Si el robot cambió de equipo, actualiza los contadores de ambos.
    if (dto.equipo && dto.equipo !== previousEquipo) {
      await this.equiposService.incrementRobotsCount(previousEquipo, -1);
      await this.equiposService.incrementRobotsCount(dto.equipo, 1);
    }

    return robot;
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const result = await this.robotModel.findByIdAndDelete(id).exec();

    if (!result) {
      throw new NotFoundException('Robot no encontrado');
    }

    await this.equiposService.incrementRobotsCount(result.equipo.toString(), -1);

    return { deleted: true };
  }
}
