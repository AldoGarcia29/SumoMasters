import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  MessageEvent,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Observable,
  catchError,
  debounceTime,
  from,
  interval,
  map,
  merge,
  of,
  switchMap,
} from 'rxjs';
import {
  Categoria,
  CategoriaDocument,
} from '../categorias/schemas/categoria.schema';
import {
  EstadoCategoria,
  TipoCombate,
} from '../categorias/enums/categoria.enums';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { User, UserDocument } from '../common/schemas/user.schema';
import { EstadoRobot } from '../robots/enums/estado-robot.enum';
import { Robot, RobotDocument } from '../robots/schemas/robot.schema';
import { EstadoTorneo } from '../torneos/enums/estado-torneo.enum';
import {
  AsignarStaffSeguilineasDto,
  CambiarTurnoDto,
  CreateSeguilineasDto,
  EditarRegistroDto,
  FinalizarSeguilineasDto,
  InscribirRobotSeguilineasDto,
  OrdenPodioDto,
  RegistrarTiempoDto,
  ReordenarColaDto,
  UpdateSeguilineasDto,
} from './dto/seguilineas.dto';
import {
  AccionAuditoria,
  EstadoRegistro,
  EstadoTurno,
} from './enums/seguilineas.enums';
import { Seguilineas, SeguilineasDocument } from './schemas/seguilineas.schema';
import { SeguilineasEventsService } from './seguilineas-events.service';

interface Cambio {
  set?: Record<string, unknown>;
  unset?: Record<string, ''>;
}

const MAX_REINTENTOS = 4;

@Injectable()
export class SeguilineasService implements OnModuleInit {
  private readonly logger = new Logger(SeguilineasService.name);

  constructor(
    @InjectModel(Seguilineas.name)
    private readonly model: Model<SeguilineasDocument>,
    @InjectModel(Robot.name) private readonly robots: Model<RobotDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Categoria.name)
    private readonly categorias: Model<CategoriaDocument>,
    private readonly events: SeguilineasEventsService,
  ) {}

  /** Migra torneos legacy (categoria: 'seguilineas' string) a la ref Categoria. */
  async onModuleInit(): Promise<void> {
    try {
      const catId = await this.categoriaSeguilineas();
      await this.model.collection.updateMany(
        { categoria: { $not: { $type: 'objectId' } } },
        { $set: { categoria: catId } },
      );
    } catch (e) {
      this.logger.error('No se pudo migrar la categoría de seguilineas', e);
    }
  }

  // ───────────── helpers ─────────────

  private oid(id: string, etiqueta = 'Id'): Types.ObjectId {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException(`${etiqueta} inválido`);
    return new Types.ObjectId(id);
  }

  private async validarStaff(ids: string[] = []): Promise<Types.ObjectId[]> {
    const unicos = [...new Set(ids)].map((i) => this.oid(i, 'Staff'));
    const validos = await this.users.countDocuments({
      _id: { $in: unicos },
      roles: Role.STAFF,
      active: true,
    });
    if (validos !== unicos.length)
      throw new BadRequestException(
        'Todos los usuarios asignados deben ser STAFF activos',
      );
    return unicos;
  }

  private exigirAcceso(
    t: { staffAsignados: Types.ObjectId[] },
    user: AuthenticatedUser,
  ): void {
    if (user.roles.includes(Role.ADMIN)) return;
    if (
      !user.roles.includes(Role.STAFF) ||
      !t.staffAsignados.some((s) => s.equals(user.id))
    )
      throw new ForbiddenException('No tienes asignado este torneo');
  }

  private async accesoTorneo(id: string, user: AuthenticatedUser) {
    const t = await this.model
      .findById(this.oid(id))
      .select('staffAsignados estado')
      .lean();
    if (!t) throw new NotFoundException('Torneo no encontrado');
    this.exigirAcceso(t, user);
    return t;
  }

  private async categoriaSeguilineas(): Promise<Types.ObjectId> {
    const c = await this.categorias
      .findOneAndUpdate(
        { tipoCombate: TipoCombate.SEGUILINEAS },
        {
          $setOnInsert: {
            nombre: 'Seguilineas',
            descripcion: 'Categoría de velocidad en pista (mejor tiempo)',
            pesoMaximoKg: null,
            tipoCombate: TipoCombate.SEGUILINEAS,
            estado: EstadoCategoria.ACTIVA,
            color: 'purple',
          },
        },
        { upsert: true, new: true, sort: { createdAt: 1 } },
      )
      .select('_id')
      .lean();
    return c!._id as Types.ObjectId;
  }

  private async resolverCategoria(
    categoriaId?: string,
  ): Promise<Types.ObjectId> {
    if (!categoriaId) return this.categoriaSeguilineas();
    const c = await this.categorias
      .findById(this.oid(categoriaId, 'Categoría'))
      .select('tipoCombate')
      .lean();
    if (!c) throw new NotFoundException('Categoría no encontrada');
    if (c.tipoCombate !== TipoCombate.SEGUILINEAS)
      throw new BadRequestException('La categoría no es de tipo Seguilineas');
    return c._id as Types.ObjectId;
  }

  private registroActual(p: any): {
    estado: EstadoRegistro;
    tiempoMs?: number;
    registradoPor?: Types.ObjectId;
    registradoEn?: Date;
  } | null {
    if (p.registro) return p.registro;
    if (typeof p.mejorTiempoMs === 'number')
      return { estado: EstadoRegistro.VALIDO, tiempoMs: p.mejorTiempoMs };
    return null;
  }

  /** Publica el ranking actualizado a todos los suscriptores SSE. */
  private async publicar(id: string) {
    const payload = await this.ranking(id);
    this.events.publicar({ torneoId: id, tipo: 'ranking', payload });
    return payload;
  }

  /**
   * Actualización atómica de un participante con control optimista (rev) y
   * operador posicional. Reintenta si otro escritor modificó el mismo participante.
   */
  private async mutarParticipante(
    id: string,
    robotId: string,
    user: AuthenticatedUser,
    opts: { permitirFinalizado: boolean },
    decidir: (p: any, estadoTorneo: EstadoTorneo) => Cambio,
  ): Promise<void> {
    const _id = this.oid(id);
    const robot = this.oid(robotId, 'Robot');

    for (let intento = 0; intento < MAX_REINTENTOS; intento++) {
      const doc: any = await this.model
        .findOne(
          { _id, participantes: { $elemMatch: { robot } } },
          { estado: 1, staffAsignados: 1, 'participantes.$': 1 },
        )
        .lean();
      if (!doc)
        throw new NotFoundException(
          'Torneo no encontrado o el robot no está inscrito',
        );
      this.exigirAcceso(doc, user);
      if (doc.estado === EstadoTorneo.FINALIZADO && !opts.permitirFinalizado)
        throw new BadRequestException('El torneo ya finalizó');

      const p = doc.participantes[0];
      const rev: number = p.rev ?? 0;
      const cambio = decidir(p, doc.estado);

      const revFiltro = rev === 0 ? { $in: [0, null] } : rev;
      const res = await this.model.findOneAndUpdate(
        {
          _id,
          estado: doc.estado,
          participantes: { $elemMatch: { robot, rev: revFiltro } },
        },
        {
          $set: { ...(cambio.set ?? {}), 'participantes.$.rev': rev + 1 },
          ...(cambio.unset && Object.keys(cambio.unset).length
            ? { $unset: cambio.unset }
            : {}),
        },
        { new: false },
      );
      if (res) {
        if (doc.estado === EstadoTorneo.FINALIZADO)
          await this.sincronizarPodio(id);
        return;
      }
    }
    throw new ConflictException(
      'El registro fue modificado simultáneamente; intenta de nuevo',
    );
  }

  // ───────────── torneos ─────────────

  async crear(dto: CreateSeguilineasDto) {
    const staffAsignados = await this.validarStaff(dto.staffIds);
    const categoria = await this.resolverCategoria(dto.categoriaId);
    try {
      return await this.model.create({
        nombre: dto.nombre.trim(),
        fecha: new Date(dto.fecha),
        descripcion: dto.descripcion ?? '',
        categoria,
        staffAsignados,
      });
    } catch (e: any) {
      if (e?.code === 11000)
        throw new ConflictException('Ya existe un torneo con ese nombre');
      throw e;
    }
  }

  async editar(id: string, dto: UpdateSeguilineasDto) {
    const _id = this.oid(id);
    const set: Record<string, unknown> = {};
    const update: Record<string, unknown> = { $set: set };
    if (dto.nombre !== undefined) set['nombre'] = dto.nombre.trim();
    if (dto.fecha) set['fecha'] = new Date(dto.fecha);
    if (dto.descripcion !== undefined) set['descripcion'] = dto.descripcion;
    if (dto.estado) {
      const actual = await this.model.findById(_id).select('estado').lean();
      if (!actual) throw new NotFoundException('Torneo no encontrado');
      if (dto.estado === EstadoTorneo.FINALIZADO) {
        // Cerrar solo por POST :id/finalizar; si ya está finalizado, el
        // estado no cambia y se ignora (permite editar nombre/descripción).
        if (actual.estado !== EstadoTorneo.FINALIZADO)
          throw new BadRequestException('Usa POST :id/finalizar para cerrar');
      } else if (dto.estado !== actual.estado) {
        set['estado'] = dto.estado;
        // Solo al reabrir un torneo finalizado el podio fijo deja de ser válido
        if (actual.estado === EstadoTorneo.FINALIZADO) {
          set['podio'] = [];
          update['$unset'] = { finalizadoPor: '', finalizadoEn: '' };
        }
      }
    }
    try {
      const t = await this.model.findByIdAndUpdate(_id, update, { new: true });
      if (!t) throw new NotFoundException('Torneo no encontrado');
      await this.publicar(id);
      return t;
    } catch (e: any) {
      if (e?.code === 11000)
        throw new ConflictException('Ya existe un torneo con ese nombre');
      throw e;
    }
  }

  async eliminar(id: string) {
    const r = await this.model.findByIdAndDelete(this.oid(id));
    if (!r) throw new NotFoundException('Torneo no encontrado');
    this.events.publicar({
      torneoId: id,
      tipo: 'eliminado',
      payload: { id },
    });
    return { eliminado: true };
  }

  async asignarStaff(id: string, dto: AsignarStaffSeguilineasDto) {
    const staffAsignados = await this.validarStaff(dto.staffIds);
    const t = await this.model.findByIdAndUpdate(
      this.oid(id),
      { $set: { staffAsignados } },
      { new: true },
    );
    if (!t) throw new NotFoundException('Torneo no encontrado');
    return t;
  }

  // ───────────── participantes / cola ─────────────

  async inscribirRobot(id: string, dto: InscribirRobotSeguilineasDto) {
    const _id = this.oid(id);
    const robot = this.oid(dto.robotId, 'Robot');

    const r = await this.robots
      .findById(robot)
      .select('categoria estado')
      .lean();
    if (!r) throw new NotFoundException('Robot no encontrado');
    if (r.estado !== EstadoRobot.ACTIVO)
      throw new BadRequestException('El robot no está activo');
    const esSeguilineas = await this.categorias.exists({
      _id: r.categoria,
      tipoCombate: TipoCombate.SEGUILINEAS,
    });
    if (!esSeguilineas)
      throw new BadRequestException(
        'El robot no pertenece a la categoría Seguilineas',
      );

    const t = await this.model.findOneAndUpdate(
      {
        _id,
        estado: { $ne: EstadoTorneo.FINALIZADO },
        'participantes.robot': { $ne: robot },
      },
      [
        { $set: { ultimoOrden: { $add: ['$ultimoOrden', 1] } } },
        {
          $set: {
            participantes: {
              $concatArrays: [
                '$participantes',
                [
                  {
                    robot,
                    ordenLlegada: '$ultimoOrden',
                    estadoTurno: EstadoTurno.EN_ESPERA,
                    rev: 0,
                  },
                ],
              ],
            },
          },
        },
      ],
      // Mongoose 9 exige declarar explícitamente los updates tipo pipeline
      { new: true, updatePipeline: true },
    );
    if (!t)
      throw new ConflictException(
        'El torneo no existe, ya finalizó o el robot ya está inscrito',
      );
    return this.publicar(id);
  }

  async quitarRobot(id: string, robotId: string) {
    const r = await this.model.updateOne(
      { _id: this.oid(id) },
      { $pull: { participantes: { robot: this.oid(robotId, 'Robot') } } },
    );
    if (!r.modifiedCount)
      throw new NotFoundException('El robot no está inscrito en este torneo');
    // Si el torneo ya estaba finalizado, el podio fijo debe reflejar el cambio
    await this.sincronizarPodio(id);
    return this.publicar(id);
  }

  async reordenarCola(
    id: string,
    dto: ReordenarColaDto,
    user: AuthenticatedUser,
  ) {
    const _id = this.oid(id);
    const t = await this.accesoTorneo(id, user);
    if (t.estado === EstadoTorneo.FINALIZADO)
      throw new BadRequestException('El torneo ya finalizó');

    const actual: any = await this.model
      .findById(_id)
      .select('participantes.robot')
      .lean();
    const actuales = new Set<string>(
      actual.participantes.map((p: any) => String(p.robot)),
    );
    if (
      dto.robotIds.length !== actuales.size ||
      !dto.robotIds.every((r) => actuales.has(r))
    )
      throw new BadRequestException(
        'La lista debe contener exactamente a todos los participantes',
      );

    const set: Record<string, unknown> = { ultimoOrden: dto.robotIds.length };
    const arrayFilters: Record<string, unknown>[] = [];
    dto.robotIds.forEach((rid, i) => {
      set[`participantes.$[p${i}].ordenLlegada`] = i + 1;
      arrayFilters.push({ [`p${i}.robot`]: new Types.ObjectId(rid) });
    });

    const res = await this.model.updateOne(
      {
        _id,
        estado: { $ne: EstadoTorneo.FINALIZADO },
        participantes: { $size: dto.robotIds.length },
      },
      { $set: set },
      { arrayFilters },
    );
    if (!res.matchedCount)
      throw new ConflictException(
        'La lista de participantes cambió; recarga e intenta de nuevo',
      );
    return this.publicar(id);
  }

  async marcarTurno(
    id: string,
    robotId: string,
    dto: CambiarTurnoDto,
    user: AuthenticatedUser,
  ) {
    const _id = this.oid(id);
    const robot = this.oid(robotId, 'Robot');
    await this.accesoTorneo(id, user);

    const set: Record<string, unknown> = {
      'participantes.$[t].estadoTurno': dto.estadoTurno,
    };
    const arrayFilters: Record<string, unknown>[] = [{ 't.robot': robot }];
    if (dto.estadoTurno === EstadoTurno.SIGUIENTE) {
      // Solo puede haber un "siguiente"
      set['participantes.$[s].estadoTurno'] = EstadoTurno.EN_ESPERA;
      arrayFilters.push({
        's.robot': { $ne: robot },
        's.estadoTurno': EstadoTurno.SIGUIENTE,
      });
    }
    const res = await this.model.updateOne(
      {
        _id,
        estado: { $ne: EstadoTorneo.FINALIZADO },
        'participantes.robot': robot,
      },
      { $set: set },
      { arrayFilters },
    );
    if (!res.matchedCount)
      throw new NotFoundException(
        'Torneo finalizado o el robot no está inscrito',
      );
    return this.publicar(id);
  }

  // ───────────── tiempos ─────────────

  async registrarTiempo(
    id: string,
    dto: RegistrarTiempoDto,
    user: AuthenticatedUser,
  ) {
    const estado = dto.estado ?? EstadoRegistro.VALIDO;
    const esValido = estado === EstadoRegistro.VALIDO;
    if (esValido && !dto.tiempoMs)
      throw new BadRequestException('tiempoMs es obligatorio para VALIDO');

    await this.mutarParticipante(
      id,
      dto.robotId,
      user,
      { permitirFinalizado: false },
      (p) => {
        const act = this.registroActual(p);
        const mejora =
          !act ||
          act.estado !== EstadoRegistro.VALIDO ||
          (esValido && dto.tiempoMs! < (act.tiempoMs as number));
        if (!mejora)
          throw new ConflictException(
            'El robot ya tiene un registro igual o mejor; edítalo si fue un error',
          );
        const set: Record<string, unknown> = {
          'participantes.$.registro': {
            estado,
            ...(esValido ? { tiempoMs: dto.tiempoMs } : {}),
            registradoPor: new Types.ObjectId(user.id),
            registradoEn: new Date(),
          },
          'participantes.$.estadoTurno': EstadoTurno.CORRIO,
        };
        const unset: Record<string, ''> = {};
        if (esValido) set['participantes.$.mejorTiempoMs'] = dto.tiempoMs;
        else unset['participantes.$.mejorTiempoMs'] = '';
        if (act)
          set['participantes.$.auditoria'] = {
            accion:
              act.estado === EstadoRegistro.VALIDO
                ? AccionAuditoria.MEJORA
                : AccionAuditoria.REEMPLAZO,
            editadoPor: new Types.ObjectId(user.id),
            editadoEn: new Date(),
            valorAnterior: {
              estado: act.estado,
              ...(act.tiempoMs !== undefined ? { tiempoMs: act.tiempoMs } : {}),
            },
          };
        return { set, unset };
      },
    );
    await this.model.updateOne(
      { _id: this.oid(id), estado: EstadoTorneo.PROGRAMADO },
      { $set: { estado: EstadoTorneo.EN_PROGRESO } },
    );
    return this.publicar(id);
  }

  /** Edita (dto) o elimina (dto = null) el registro del robot. */
  async modificarIntento(
    id: string,
    robotId: string,
    dto: EditarRegistroDto | null,
    user: AuthenticatedUser,
  ) {
    await this.mutarParticipante(
      id,
      robotId,
      user,
      { permitirFinalizado: user.roles.includes(Role.ADMIN) },
      (p) => {
        const act = this.registroActual(p);
        if (!act)
          throw new NotFoundException('Registro de tiempo no encontrado');
        const valorAnterior = {
          estado: act.estado,
          ...(act.tiempoMs !== undefined ? { tiempoMs: act.tiempoMs } : {}),
        };
        const audit = (accion: AccionAuditoria) => ({
          accion,
          editadoPor: new Types.ObjectId(user.id),
          editadoEn: new Date(),
          valorAnterior,
        });

        if (dto === null)
          return {
            set: {
              'participantes.$.auditoria': audit(AccionAuditoria.ELIMINACION),
              'participantes.$.estadoTurno': EstadoTurno.EN_ESPERA,
            },
            unset: {
              'participantes.$.registro': '',
              'participantes.$.mejorTiempoMs': '',
            },
          };

        const estado = dto.estado ?? act.estado;
        const esValido = estado === EstadoRegistro.VALIDO;
        const tiempoMs = esValido ? (dto.tiempoMs ?? act.tiempoMs) : undefined;
        if (esValido && !tiempoMs)
          throw new BadRequestException('tiempoMs es obligatorio para VALIDO');

        const set: Record<string, unknown> = {
          'participantes.$.registro': {
            estado,
            ...(esValido ? { tiempoMs } : {}),
            registradoPor: act.registradoPor ?? new Types.ObjectId(user.id),
            registradoEn: act.registradoEn ?? new Date(),
          },
          'participantes.$.auditoria': audit(AccionAuditoria.EDICION),
        };
        const unset: Record<string, ''> = {};
        if (esValido) set['participantes.$.mejorTiempoMs'] = tiempoMs;
        else unset['participantes.$.mejorTiempoMs'] = '';
        return { set, unset };
      },
    );
    return this.publicar(id);
  }

  // ───────────── cierre / podio ─────────────

  private validarOrdenEmpates(filas: any[], robotIds: string[]): string[] {
    const tiempos = new Map<string, number>(
      filas.map((f) => [f.robotId, f.mejorTiempoMs as number]),
    );
    if (
      robotIds.length !== tiempos.size ||
      !robotIds.every((r) => tiempos.has(r))
    )
      throw new BadRequestException(
        'La lista debe contener exactamente a los robots con tiempo válido',
      );
    for (let i = 1; i < robotIds.length; i++)
      if (tiempos.get(robotIds[i])! < tiempos.get(robotIds[i - 1])!)
        throw new BadRequestException(
          'Solo se puede reordenar entre robots con el mismo tiempo',
        );
    return robotIds;
  }

  private armarPodio(filas: any[], orden: string[]) {
    const tiempos = new Map<string, number>(
      filas.map((f) => [f.robotId, f.mejorTiempoMs as number]),
    );
    return orden.map((rid, i) => ({
      robot: new Types.ObjectId(rid),
      posicion: i + 1,
      mejorTiempoMs: tiempos.get(rid)!,
    }));
  }

  private filasValidas(r: { ranking: any[] }): any[] {
    return r.ranking.filter(
      (f) => f.estadoRegistro === EstadoRegistro.VALIDO,
    );
  }

  /** Re-snapshot del podio tras una edición admin posterior al cierre. */
  private async sincronizarPodio(id: string): Promise<void> {
    const filas = this.filasValidas(await this.ranking(id));
    await this.model.updateOne(
      { _id: this.oid(id), estado: EstadoTorneo.FINALIZADO },
      {
        $set: {
          podio: this.armarPodio(
            filas,
            filas.map((f) => f.robotId),
          ),
        },
      },
    );
  }

  async finalizar(
    id: string,
    dto: FinalizarSeguilineasDto,
    user: AuthenticatedUser,
  ) {
    const t = await this.accesoTorneo(id, user);
    if (t.estado === EstadoTorneo.FINALIZADO)
      throw new BadRequestException('El torneo ya finalizó');

    const filas = this.filasValidas(await this.ranking(id));
    const orden = dto.robotIds
      ? this.validarOrdenEmpates(filas, dto.robotIds)
      : filas.map((f) => f.robotId);

    const res = await this.model.updateOne(
      { _id: this.oid(id), estado: { $ne: EstadoTorneo.FINALIZADO } },
      {
        $set: {
          estado: EstadoTorneo.FINALIZADO,
          podio: this.armarPodio(filas, orden),
          finalizadoPor: new Types.ObjectId(user.id),
          finalizadoEn: new Date(),
        },
      },
    );
    if (!res.matchedCount)
      throw new ConflictException('El torneo ya fue finalizado');
    return this.publicar(id);
  }

  /** Desempate manual: reordena robots con el mismo mejor tiempo (antes o después del cierre). */
  async reordenarPodio(id: string, dto: OrdenPodioDto, user: AuthenticatedUser) {
    await this.accesoTorneo(id, user);
    const filas = this.filasValidas(await this.ranking(id));
    const orden = this.validarOrdenEmpates(filas, dto.robotIds);
    await this.model.updateOne(
      { _id: this.oid(id) },
      { $set: { podio: this.armarPodio(filas, orden) } },
    );
    return this.publicar(id);
  }

  // ───────────── lecturas ─────────────

  async misTorneos(user: AuthenticatedUser) {
    const filtro = user.roles.includes(Role.ADMIN)
      ? {}
      : { staffAsignados: new Types.ObjectId(user.id) };
    return this.model
      .find(filtro)
      .select('nombre fecha estado descripcion staffAsignados categoria')
      .populate('categoria', 'nombre tipoCombate color')
      .sort({ fecha: -1 })
      .lean();
  }

  async listarPublicos(categoriaId?: string) {
    const filtro = categoriaId
      ? { categoria: this.oid(categoriaId, 'Categoría') }
      : {};
    return this.model
      .find(filtro)
      .select('nombre fecha estado categoria')
      .populate('categoria', 'nombre tipoCombate color')
      .sort({ fecha: -1 })
      .lean();
  }

  async activo() {
    const t =
      (await this.model
        .findOne({ estado: EstadoTorneo.EN_PROGRESO })
        .sort({ fecha: -1 })
        .select('_id')
        .lean()) ??
      (await this.model.findOne().sort({ fecha: -1 }).select('_id').lean());
    return t ? this.ranking(String(t._id)) : null;
  }

  /**
   * Todos los torneos de Seguilineas en progreso (con su ranking), del más
   * reciente al más antiguo. Alimenta la barra de patrocinadores. El primer
   * tiempo registrado pasa el torneo a "En progreso" y finalizarlo lo saca.
   */
  async activos() {
    const torneos = await this.model
      .find({ estado: EstadoTorneo.EN_PROGRESO })
      .sort({ fecha: -1 })
      .select('_id')
      .lean();
    const rankings = await Promise.allSettled(
      torneos.map((t) => this.ranking(String(t._id))),
    );
    // Si un torneo se elimina entre las dos consultas, simplemente se omite.
    return rankings.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  }

  async ranking(id: string) {
    const t: any = await this.model
      .findById(this.oid(id))
      .populate('participantes.robot', 'nombre')
      .populate('participantes.auditoria.editadoPor', 'name')
      .lean();
    if (!t) throw new NotFoundException('Torneo no encontrado');

    const podioIdx = new Map<string, number>(
      (t.podio ?? []).map((x: any, i: number) => [String(x.robot), i]),
    );
    const grupo = (e: EstadoRegistro | null) =>
      e === EstadoRegistro.VALIDO
        ? 0
        : e === EstadoRegistro.DNF
          ? 1
          : e === EstadoRegistro.DESCALIFICADO
            ? 2
            : 3;

    const base = t.participantes
      .filter((p: any) => p.robot)
      .map((p: any) => {
        const reg = this.registroActual(p);
        const valido = reg?.estado === EstadoRegistro.VALIDO;
        return {
          robotId: String(p.robot._id),
          nombre: p.robot.nombre as string,
          ordenLlegada: p.ordenLlegada as number,
          estadoTurno: (p.estadoTurno ?? EstadoTurno.EN_ESPERA) as EstadoTurno,
          estadoRegistro: (reg?.estado ?? null) as EstadoRegistro | null,
          mejorTiempoMs: (valido ? (reg!.tiempoMs ?? null) : null) as
            | number
            | null,
          registradoEn: (reg?.registradoEn ?? null) as Date | null,
          auditoria: p.auditoria
            ? {
                accion: p.auditoria.accion,
                editadoPor: p.auditoria.editadoPor?.name ?? null,
                editadoEn: p.auditoria.editadoEn,
                valorAnterior: p.auditoria.valorAnterior ?? null,
              }
            : null,
        };
      });

    const conteoTiempos = new Map<number, number>();
    base.forEach((f: any) => {
      if (f.mejorTiempoMs !== null)
        conteoTiempos.set(
          f.mejorTiempoMs,
          (conteoTiempos.get(f.mejorTiempoMs) ?? 0) + 1,
        );
    });

    const filas = base
      .sort(
        (a: any, b: any) =>
          grupo(a.estadoRegistro) - grupo(b.estadoRegistro) ||
          (a.mejorTiempoMs ?? Infinity) - (b.mejorTiempoMs ?? Infinity) ||
          (podioIdx.get(a.robotId) ?? Infinity) -
            (podioIdx.get(b.robotId) ?? Infinity) ||
          a.ordenLlegada - b.ordenLlegada,
      )
      .map((f: any, i: number) => ({
        posicion: i + 1,
        ...f,
        empatado:
          f.mejorTiempoMs !== null &&
          (conteoTiempos.get(f.mejorTiempoMs) ?? 0) > 1,
      }));

    const cola = [...filas]
      .sort((a: any, b: any) => a.ordenLlegada - b.ordenLlegada)
      .map((f: any) => ({
        robotId: f.robotId,
        nombre: f.nombre,
        ordenLlegada: f.ordenLlegada,
        estadoTurno: f.estadoTurno,
        estadoRegistro: f.estadoRegistro,
        mejorTiempoMs: f.mejorTiempoMs,
      }));
    const siguiente =
      cola.find((c: any) => c.estadoTurno === EstadoTurno.SIGUIENTE) ??
      cola.find((c: any) => c.estadoTurno === EstadoTurno.EN_ESPERA) ??
      null;

    const recientes = filas
      .filter((f: any) => f.estadoRegistro && f.registradoEn)
      .map((f: any) => ({
        robotId: f.robotId,
        nombre: f.nombre,
        estadoRegistro: f.estadoRegistro,
        tiempoMs: f.mejorTiempoMs,
        registradoEn: f.registradoEn,
      }))
      .sort(
        (a: any, b: any) =>
          +new Date(b.registradoEn) - +new Date(a.registradoEn),
      )
      .slice(0, 10);

    const validos = filas.filter(
      (f: any) => f.estadoRegistro === EstadoRegistro.VALIDO,
    );
    const finalizado = t.estado === EstadoTorneo.FINALIZADO;
    const podio = finalizado
      ? (t.podio ?? [])
          .slice(0, 3)
          .map((x: any) => {
            const f = filas.find((r: any) => r.robotId === String(x.robot));
            return f
              ? {
                  posicion: x.posicion as number,
                  robotId: f.robotId,
                  nombre: f.nombre,
                  mejorTiempoMs: x.mejorTiempoMs as number,
                }
              : null;
          })
          .filter(Boolean)
      : [];

    return {
      id: String(t._id),
      nombre: t.nombre,
      fecha: t.fecha,
      estado: t.estado,
      categoria: String(t.categoria),
      generadoEn: Date.now(),
      hayRegistros: validos.length > 0,
      ranking: filas,
      top3: validos.slice(0, 3),
      podio,
      cola,
      siguiente,
      hayEmpates: validos.some((f: any) => f.empatado),
      recientes,
    };
  }

  async gestion(id: string, user: AuthenticatedUser) {
    await this.accesoTorneo(id, user);
    return this.ranking(id);
  }

  // ───────────── tiempo real (SSE) ─────────────

  private ping(): MessageEvent {
    return { type: 'ping', data: { t: Date.now() } };
  }

  /** Stream de un torneo: snapshot inicial + cambios + heartbeat. */
  stream(id: string): Observable<MessageEvent> {
    this.oid(id);
    return merge(
      from(this.ranking(id)).pipe(
        map((data): MessageEvent => ({ type: 'ranking', data })),
        catchError(() => of<MessageEvent>({ type: 'eliminado', data: { id } })),
      ),
      this.events.deTorneo(id).pipe(
        map(
          (e): MessageEvent => ({
            type: e.tipo,
            data: e.payload as object,
          }),
        ),
      ),
      interval(25_000).pipe(map(() => this.ping())),
    );
  }

  /** Stream del torneo activo (ticker / barra de patrocinadores). */
  streamActivo(): Observable<MessageEvent> {
    return merge(
      merge(of(null), this.events.todos().pipe(debounceTime(150))).pipe(
        switchMap(() =>
          from(this.activo()).pipe(catchError(() => of(null))),
        ),
        map(
          (data): MessageEvent => ({
            type: 'ranking',
            data: data ?? { id: null },
          }),
        ),
      ),
      interval(25_000).pipe(map(() => this.ping())),
    );
  }
}
