import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EquiposService } from '../equipos/equipos.service';
import { Torneo, TorneoDocument } from '../torneos/schemas/torneo.schema';
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
    @InjectModel(Torneo.name)
    private readonly torneoModel: Model<TorneoDocument>,
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
  }): Promise<any[]> {
    // Cambiamos temporalmente a any[] para inyectar los nombres
    const query: Record<string, unknown> = {};

    if (filters?.equipo) query.equipo = filters.equipo;
    if (filters?.categoria) query.categoria = filters.categoria;
    if (filters?.estado) query.estado = filters.estado;
    if (filters?.search) {
      query.nombre = { $regex: filters.search, $options: 'i' };
    }

    // 1. Traemos los robots limpios sin populate (esto jamás fallará)
    const robots = await this.robotModel
      .find(query)
      .sort({ createdAt: -1 })
      .lean() // .lean() nos permite modificar el objeto plano de JS fácilmente
      .exec();

    // Si no hay robots, regresamos vacío
    if (!robots.length) return [];

    // 2. Extraemos los IDs únicos de equipos y categorías para buscarlos de golpe
    const equipoIds = [...new Set(robots.map((r) => r.equipo))];
    const categoriaIds = [...new Set(robots.map((r) => r.categoria))];

    // 3. Consultamos las colecciones directamente con sus modelos (asegúrate de inyectar sus Model en el constructor del servicio)
    // O puedes usar los servicios correspondientes si ya los tienes inyectados.

    // Ejemplo si inyectas los Model en el constructor:
    /*
    const equipos = await this.equipoModel.find({ _id: { $in: equipoIds } }).select('nombre institucion').lean();
    const categorias = await this.categoriaModel.find({ _id: { $in: categoriaIds } }).select('nombre tipoCombate').lean();

    // 4. Mapeamos los datos para entregárselos al frontend exactamente como los espera
    const equiposMap = new Map(equipos.map(e => [String(e._id), e]));
    const categoriasMap = new Map(categorias.map(c => [String(c._id), c]));

    return robots.map(robot => ({
      ...robot,
      equipo: equiposMap.get(String(robot.equipo)) || robot.equipo,
      categoria: categoriasMap.get(String(robot.categoria)) || robot.categoria,
    }));
    */

    return robots;
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

    await this.equiposService.incrementRobotsCount(
      result.equipo.toString(),
      -1,
    );

    // Limpia cualquier referencia a este robot en la lista de inscritos de
    // los torneos, para que no queden referencias "fantasma" que rompan la
    // generación de bloques u otras operaciones más adelante.
    await this.torneoModel
      .updateMany({ robotsInscritos: id }, { $pull: { robotsInscritos: id } })
      .exec();

    return { deleted: true };
  }
}
