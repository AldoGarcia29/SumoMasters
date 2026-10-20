import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EquiposService } from '../equipos/equipos.service';
import { Torneo, TorneoDocument } from '../torneos/schemas/torneo.schema';
import { Robot, RobotDocument } from './schemas/robot.schema';
import { CreateRobotDto } from './dto/create-robot.dto';
import { UpdateRobotDto } from './dto/update-robot.dto';

// Importamos las clases para poder inyectar sus modelos
import { Equipo } from '../equipos/schemas/equipo.schema';
import { Categoria } from '../categorias/schemas/categoria.schema';

@Injectable()
export class RobotsService {
  constructor(
    @InjectModel(Robot.name) private readonly robotModel: Model<RobotDocument>,
    @InjectModel(Torneo.name)
    private readonly torneoModel: Model<TorneoDocument>,
    @InjectModel(Equipo.name) private readonly equipoModel: Model<any>,
    @InjectModel(Categoria.name) private readonly categoriaModel: Model<any>,
    private readonly equiposService: EquiposService,
  ) {}

  async create(dto: CreateRobotDto): Promise<any> {
    const robot = new this.robotModel({
      ...dto,
      nombre: dto.nombre.trim(),
      pesoKg: dto.pesoKg ?? null,
    });

    await robot.save();
    await this.equiposService.incrementRobotsCount(dto.equipo, 1);

    // Hacemos la consulta manual al crear
    const equipoObj = await this.equipoModel
      .findById(robot.equipo)
      .select('nombre')
      .lean()
      .exec();
    const categoriaObj = await this.categoriaModel
      .findById(robot.categoria)
      .select('nombre')
      .lean()
      .exec();

    return {
      ...robot.toObject(),
      equipo: equipoObj || robot.equipo,
      categoria: categoriaObj || robot.categoria,
    };
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

    // Traemos los robots en formato plano
    const robots = await this.robotModel
      .find(query)
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (!robots.length) return [];

    // Extraemos los IDs únicos para optimizar la consulta
    const equipoIds = [...new Set(robots.map((r) => r.equipo))];
    const categoriaIds = [...new Set(robots.map((r) => r.categoria))];

    // Buscamos los nombres directamente en sus colecciones
    const equipos = await this.equipoModel
      .find({ _id: { $in: equipoIds } })
      .select('nombre')
      .lean()
      .exec();
    const categorias = await this.categoriaModel
      .find({ _id: { $in: categoriaIds } })
      .select('nombre')
      .lean()
      .exec();

    // Mapeamos los resultados
    const equiposMap = new Map(equipos.map((e) => [String(e._id), e]));
    const categoriasMap = new Map(categorias.map((c) => [String(c._id), c]));

    // Reconstruimos la respuesta inyectando los objetos con los nombres
    return robots.map((robot) => ({
      ...robot,
      equipo: equiposMap.get(String(robot.equipo)) || { nombre: 'Desconocido' },
      categoria: categoriasMap.get(String(robot.categoria)) || {
        nombre: 'Desconocido',
      },
    }));
  }

  async findOne(id: string): Promise<any> {
    const robot = await this.robotModel.findById(id).lean().exec();

    if (!robot) throw new NotFoundException('Robot no encontrado');

    const equipoObj = await this.equipoModel
      .findById(robot.equipo)
      .select('nombre')
      .lean()
      .exec();
    const categoriaObj = await this.categoriaModel
      .findById(robot.categoria)
      .select('nombre')
      .lean()
      .exec();

    return {
      ...robot,
      equipo: equipoObj || robot.equipo,
      categoria: categoriaObj || robot.categoria,
    };
  }

  async update(id: string, dto: UpdateRobotDto): Promise<any> {
    const existing = await this.robotModel.findById(id).exec();
    if (!existing) throw new NotFoundException('Robot no encontrado');

    const previousEquipo = existing.equipo.toString();

    const robot = await this.robotModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true, runValidators: true })
      .lean()
      .exec();

    if (!robot) throw new NotFoundException('Robot no encontrado');

    if (dto.equipo && dto.equipo !== previousEquipo) {
      await this.equiposService.incrementRobotsCount(previousEquipo, -1);
      await this.equiposService.incrementRobotsCount(dto.equipo, 1);
    }

    const equipoObj = await this.equipoModel
      .findById(robot.equipo)
      .select('nombre')
      .lean()
      .exec();
    const categoriaObj = await this.categoriaModel
      .findById(robot.categoria)
      .select('nombre')
      .lean()
      .exec();

    return {
      ...robot,
      equipo: equipoObj || robot.equipo,
      categoria: categoriaObj || robot.categoria,
    };
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const result = await this.robotModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Robot no encontrado');

    await this.equiposService.incrementRobotsCount(
      result.equipo.toString(),
      -1,
    );
    await this.torneoModel
      .updateMany({ robotsInscritos: id }, { $pull: { robotsInscritos: id } })
      .exec();

    return { deleted: true };
  }
}
