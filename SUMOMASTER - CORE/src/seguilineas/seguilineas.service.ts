import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { User, UserDocument } from '../common/schemas/user.schema';
import { Robot, RobotDocument } from '../robots/schemas/robot.schema';
import { EstadoTorneo } from '../torneos/enums/estado-torneo.enum';
import { AsignarStaffSeguilineasDto, CreateSeguilineasDto, InscribirRobotSeguilineasDto, RegistrarTiempoDto } from './dto/seguilineas.dto';
import { Seguilineas, SeguilineasDocument } from './schemas/seguilineas.schema';

@Injectable()
export class SeguilineasService {
  constructor(
    @InjectModel(Seguilineas.name) private readonly model: Model<SeguilineasDocument>,
    @InjectModel(Robot.name) private readonly robots: Model<RobotDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
  ) {}

  private oid(id: string, etiqueta = 'Id'): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException(`${etiqueta} inválido`);
    return new Types.ObjectId(id);
  }

  private async validarStaff(ids: string[] = []): Promise<Types.ObjectId[]> {
    const unicos = [...new Set(ids)].map((i) => this.oid(i, 'Staff'));
    const validos = await this.users.countDocuments({ _id: { $in: unicos }, roles: Role.STAFF, active: true });
    if (validos !== unicos.length) throw new BadRequestException('Todos los usuarios asignados deben ser STAFF activos');
    return unicos;
  }

  /** ADMIN siempre; STAFF solo si el torneo está en su lista de asignados. */
  private exigirAcceso(t: { staffAsignados: Types.ObjectId[] }, user: AuthenticatedUser): void {
    if (user.roles.includes(Role.ADMIN)) return;
    if (!user.roles.includes(Role.STAFF) || !t.staffAsignados.some((s) => s.equals(user.id)))
      throw new ForbiddenException('No tienes asignado este torneo');
  }

  async crear(dto: CreateSeguilineasDto) {
    const staffAsignados = await this.validarStaff(dto.staffIds);
    try {
      return await this.model.create({ nombre: dto.nombre, fecha: new Date(dto.fecha), descripcion: dto.descripcion ?? '', staffAsignados });
    } catch (e: any) {
      if (e?.code === 11000) throw new ConflictException('Ya existe un torneo con ese nombre');
      throw e;
    }
  }

  async asignarStaff(id: string, dto: AsignarStaffSeguilineasDto) {
    const staffAsignados = await this.validarStaff(dto.staffIds);
    const t = await this.model.findByIdAndUpdate(this.oid(id), { $set: { staffAsignados } }, { new: true });
    if (!t) throw new NotFoundException('Torneo no encontrado');
    return t;
  }

  async inscribirRobot(id: string, dto: InscribirRobotSeguilineasDto) {
    const _id = this.oid(id);
    const robot = this.oid(dto.robotId, 'Robot');
    if (!(await this.robots.exists({ _id: robot }))) throw new NotFoundException('Robot no encontrado');
    // Pipeline atómico: incrementa el contador y asigna ese valor como orden de llegada.
    const t = await this.model.findOneAndUpdate(
      { _id, 'participantes.robot': { $ne: robot } },
      [
        { $set: { ultimoOrden: { $add: ['$ultimoOrden', 1] } } },
        { $set: { participantes: { $concatArrays: ['$participantes', [{ robot, ordenLlegada: '$ultimoOrden', intentos: [] }]] } } },
      ],
      { new: true },
    );
    if (!t) throw new ConflictException('El torneo no existe o el robot ya está inscrito');
    return this.ranking(id);
  }

  async registrarTiempo(id: string, dto: RegistrarTiempoDto, user: AuthenticatedUser) {
    const _id = this.oid(id);
    const t = await this.model.findById(_id).select('staffAsignados estado').lean();
    if (!t) throw new NotFoundException('Torneo no encontrado');
    this.exigirAcceso(t, user);
    if (t.estado === EstadoTorneo.FINALIZADO) throw new BadRequestException('El torneo ya finalizó');

    const res = await this.model.updateOne(
      { _id, 'participantes.robot': this.oid(dto.robotId, 'Robot') },
      {
        $push: { 'participantes.$.intentos': { tiempoMs: dto.tiempoMs, registradoPor: new Types.ObjectId(user.id), registradoEn: new Date() } },
        $min: { 'participantes.$.mejorTiempoMs': dto.tiempoMs },
      },
    );
    if (!res.matchedCount) throw new NotFoundException('El robot no está inscrito en este torneo');
    await this.model.updateOne({ _id, estado: EstadoTorneo.PROGRAMADO }, { $set: { estado: EstadoTorneo.EN_PROGRESO } });
    return this.ranking(id);
  }

  async misTorneos(user: AuthenticatedUser) {
    const filtro = user.roles.includes(Role.ADMIN) ? {} : { staffAsignados: new Types.ObjectId(user.id) };
    return this.model.find(filtro).select('nombre fecha estado').sort({ fecha: -1 }).lean();
  }

  async listarPublicos() {
    return this.model.find().select('nombre fecha estado').sort({ fecha: -1 }).lean();
  }

  /** Torneo "en progreso" más reciente; si no hay, el más reciente. Usado por el ticker. */
  async activo() {
    const t =
      (await this.model.findOne({ estado: EstadoTorneo.EN_PROGRESO }).sort({ fecha: -1 }).select('_id').lean()) ??
      (await this.model.findOne().sort({ fecha: -1 }).select('_id').lean());
    return t ? this.ranking(String(t._id)) : null;
  }

  /** Sin tiempos: orden de llegada. Con tiempos: mejor tiempo asc; los que aún no corren van al final por llegada. */
  async ranking(id: string) {
    const t: any = await this.model.findById(this.oid(id)).populate('participantes.robot', 'nombre').lean();
    if (!t) throw new NotFoundException('Torneo no encontrado');

    const filas = t.participantes
      .filter((p: any) => p.robot)
      .map((p: any) => ({
        robotId: String(p.robot._id),
        nombre: p.robot.nombre as string,
        ordenLlegada: p.ordenLlegada as number,
        mejorTiempoMs: (p.mejorTiempoMs ?? null) as number | null,
        intentos: p.intentos.length as number,
      }))
      .sort((a: any, b: any) => (a.mejorTiempoMs ?? Infinity) - (b.mejorTiempoMs ?? Infinity) || a.ordenLlegada - b.ordenLlegada)
      .map((f: any, i: number) => ({ posicion: i + 1, ...f }));

    const recientes = t.participantes
      .filter((p: any) => p.robot)
      .flatMap((p: any) => p.intentos.map((i: any) => ({ robotId: String(p.robot._id), nombre: p.robot.nombre, tiempoMs: i.tiempoMs, registradoEn: i.registradoEn })))
      .sort((a: any, b: any) => +new Date(b.registradoEn) - +new Date(a.registradoEn))
      .slice(0, 10);

    const hayRegistros = filas.some((f: any) => f.mejorTiempoMs !== null);
    return {
      id: String(t._id), nombre: t.nombre, fecha: t.fecha, estado: t.estado, hayRegistros,
      ranking: filas,
      top3: hayRegistros ? filas.filter((f: any) => f.mejorTiempoMs !== null).slice(0, 3) : [],
      recientes,
    };
  }

  /** Vista de gestión: mismo ranking, con control de acceso por torneo asignado. */
  async gestion(id: string, user: AuthenticatedUser) {
    const t = await this.model.findById(this.oid(id)).select('staffAsignados').lean();
    if (!t) throw new NotFoundException('Torneo no encontrado');
    this.exigirAcceso(t, user);
    return this.ranking(id);
  }
}
