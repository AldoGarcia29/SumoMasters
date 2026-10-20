import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EquiposService } from '../equipos/equipos.service';
import { Torneo, TorneoDocument } from '../torneos/schemas/torneo.schema';
import { Equipo, EquipoDocument } from '../equipos/schemas/equipo.schema';
import {
  Categoria,
  CategoriaDocument,
} from '../categorias/schemas/categoria.schema';
import { CreateRobotDto } from './dto/create-robot.dto';
import { UpdateRobotDto } from './dto/update-robot.dto';
import { Robot, RobotDocument } from './schemas/robot.schema';

@Injectable()
export class RobotsService {
  constructor(
    @InjectModel(Robot.name) private readonly robotModel: Model<RobotDocument>,
    @InjectModel(Torneo.name)
    private readonly torneoModel: Model<TorneoDocument>,
    @InjectModel(Equipo.name)
    private readonly equipoModel: Model<EquipoDocument>,
    @InjectModel(Categoria.name)
    private readonly categoriaModel: Model<CategoriaDocument>,
    private readonly equiposService: EquiposService,
  ) {}

  private async enrichRobot(robot: any) {
    if (!robot) return robot;
    const robotObj = robot.toObject ? robot.toObject() : { ...robot };

    // Buscamos el equipo y la categoría manualmente para asegurar los datos sin depender de populate
    const [equipo, categoria] = await Promise.all([
      robotObj.equipo
        ? this.equipoModel
            .findById(robotObj.equipo)
            .select('nombre institucion')
            .lean()
        : null,
      robotObj.categoria
        ? this.categoriaModel
            .findById(robotObj.categoria)
            .select('nombre tipoCombate')
            .lean()
        : null,
    ]);

    return {
      ...robotObj,
      equipo: equipo || robotObj.equipo,
      categoria: categoria || robotObj.categoria,
    };
  }

  async create(dto: CreateRobotDto): Promise<any> {
    const robot = new this.robotModel({
      ...dto,
      nombre: dto.nombre.trim(),
      pesoKg: dto.pesoKg ?? null,
    });

    await robot.save();
    await this.equiposService.incrementRobotsCount(dto.equipo, 1);

    return this.enrichRobot(robot);
  }

  async findAll(filters?: {
    search?: string;
    equipo?: string;
    categoria?: string;
    estado?: string;
  }): Promise<any[]> {
    const query: Record<string, unknown> = {};

    if (filters?.equipo) query.equipo = filters.equipo;
    if (filters?.categoria) query.categoria = filters.categoria;
    if (filters?.estado) query.estado = filters.estado;
    if (filters?.search) {
      query.nombre = { $regex: filters.search, $options: 'i' };
    }

    const robots = await this.robotModel
      .find(query)
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (!robots.length) return [];

    // Enriquecemos todos los robots concurrentemente de forma segura
    return Promise.all(robots.map((robot) => this.enrichRobot(robot)));
  }

  async findOne(id: string): Promise<any> {
    const robot = await this.robotModel.findById(id).lean().exec();

    if (!robot) {
      throw new NotFoundException('Robot no encontrado');
    }

    return this.enrichRobot(robot);
  }

  async update(id: string, dto: UpdateRobotDto): Promise<any> {
    const existing = await this.robotModel.findById(id).lean().exec();

    if (!existing) {
      throw new NotFoundException('Robot no encontrado');
    }

    const previousEquipo = existing.equipo ? String(existing.equipo) : null;

    const robot = await this.robotModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true, runValidators: true })
      .lean()
      .exec();

    if (!robot) {
      throw new NotFoundException('Robot no encontrado');
    }

    if (dto.equipo && previousEquipo && dto.equipo !== previousEquipo) {
      await this.equiposService.incrementRobotsCount(previousEquipo, -1);
      await this.equiposService.incrementRobotsCount(dto.equipo, 1);
    }

    return this.enrichRobot(robot);
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const result = await this.robotModel.findByIdAndDelete(id).lean().exec();

    if (!result) {
      throw new NotFoundException('Robot no encontrado');
    }

    if (result.equipo) {
      await this.equiposService.incrementRobotsCount(String(result.equipo), -1);
    }

    await this.torneoModel
      .updateMany({ robotsInscritos: id }, { $pull: { robotsInscritos: id } })
      .exec();

    return { deleted: true };
  }
}
