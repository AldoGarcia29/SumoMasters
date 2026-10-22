import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AsignacionStaff, AsignacionStaffDocument } from './schemas/asignacion-staff.schema';
import { User, UserDocument } from '../common/schemas/user.schema';
import { Dojo, DojoDocument } from '../dojos/schemas/dojo.schema';
import { CrearAsignacionStaffDto } from './dto/crear-asignacion-staff.dto';

@Injectable()
export class AsignacionesStaffService {
  constructor(
    @InjectModel(AsignacionStaff.name) private readonly asignaciones: Model<AsignacionStaffDocument>,
    @InjectModel(User.name) private readonly usuarios: Model<UserDocument>,
    @InjectModel(Dojo.name) private readonly dojos: Model<DojoDocument>,
  ) {}
  fechaLocal(fecha: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(fecha);
  }
  async crear(dto: CrearAsignacionStaffDto) {
    const usuario = await this.usuarios.findById(dto.usuarioId);
    if (!usuario || !usuario.active || !usuario.roles.includes('STAFF' as any))
      throw new BadRequestException('El usuario debe ser STAFF activo');
    const dojo = await this.dojos.findById(dto.dojoId);
    if (!dojo || !/^\s*(?:dojo\s*)?[1-5]\s*$/i.test(dojo.nombre))
      throw new BadRequestException('Selecciona un dojo del 1 al 5');
    if (Number.isNaN(Date.parse(dto.fecha + 'T12:00:00Z')) || new Date(dto.fecha + 'T12:00:00Z').toISOString().slice(0,10) !== dto.fecha)
      throw new BadRequestException('Fecha inválida');
    try {
      return await this.asignaciones.findOneAndUpdate(
        { usuario: new Types.ObjectId(dto.usuarioId), torneo: new Types.ObjectId(dto.torneoId),
          dojo: new Types.ObjectId(dto.dojoId), fecha: dto.fecha },
        { $setOnInsert: { usuario: dto.usuarioId, torneo: dto.torneoId, dojo: dto.dojoId, fecha: dto.fecha } },
        { upsert: true, new: true, runValidators: true },
      );
    } catch (e) { throw new BadRequestException('No se pudo guardar la asignación'); }
  }
  async listar(torneoId?: string, usuarioId?: string) {
    const filtro: Record<string, unknown> = {};
    if (torneoId) {
      if (!Types.ObjectId.isValid(torneoId)) throw new BadRequestException('Torneo inválido');
      filtro['torneo'] = new Types.ObjectId(torneoId);
    }
    if (usuarioId) {
      if (!Types.ObjectId.isValid(usuarioId)) throw new BadRequestException('Usuario inválido');
      filtro['usuario'] = new Types.ObjectId(usuarioId);
    }
    const resultados = await this.asignaciones.find(filtro).sort({ fecha: 1 }).lean().exec();
    if (usuarioId && resultados.length === 0) {
      const total = await this.asignaciones.countDocuments();
      console.warn('[STAFF ASIGNACIONES] Sin coincidencias para usuario autenticado', {
        totalAsignaciones: total,
        consultaConUsuario: true,
      });
    }
    return resultados;
  }
  async eliminar(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Asignación inválida');
    const deleted = await this.asignaciones.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException('Asignación no encontrada');
    return { eliminado: true };
  }
  async permitido(usuarioId: string, torneoId: string, dojoId: string, fecha: Date | null) {
    if (!fecha || !dojoId) return false;
    if (![usuarioId, torneoId, dojoId].every(id => Types.ObjectId.isValid(id))) return false;
    return !!await this.asignaciones.exists({
      usuario: new Types.ObjectId(usuarioId), torneo: new Types.ObjectId(torneoId),
      dojo: new Types.ObjectId(dojoId), fecha: this.fechaLocal(fecha),
    });
  }
  async exigir(usuarioId: string, torneoId: string, dojoId: string, fecha: Date | null) {
    if (!await this.permitido(usuarioId, torneoId, dojoId, fecha))
      throw new ForbiddenException('No tienes asignado este dojo para la fecha del combate');
  }
}
