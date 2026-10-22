import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Bloque, BloqueDocument } from '../bloques/schemas/bloque.schema';

import { Dojo, DojoDocument } from '../dojos/schemas/dojo.schema';

import {
  EstadoCombate,
  FaseCombate,
  MetodoVictoria,
  ResultadoCombate,
} from './enums/combate.enums';

import { EstadoDojo } from '../dojos/enums/estado-dojo.enum';
import { AsignarDojoDto } from './dto/asignar-dojo.dto';
import { GenerarCombatesDto } from './dto/generar-combates.dto';
import { RegistrarResultadoDto } from './dto/registrar-resultado.dto';

import { Combate, CombateDocument } from './schemas/combate.schema';
import { AsignacionesStaffService } from './asignaciones-staff.service';
import { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';

import { ActualizarHorarioCombateDto } from './dto/actualizar-horario-combate.dto';

const POPULATE = [
  {
    path: 'robot1',
    select: 'nombre imagenUrl equipo',
    populate: { path: 'equipo', select: 'nombre' },
  },
  {
    path: 'robot2',
    select: 'nombre imagenUrl equipo',
    populate: { path: 'equipo', select: 'nombre' },
  },
  { path: 'dojo', select: 'nombre estado' },
  { path: 'bloque', select: 'nombre' },
];

@Injectable()
export class CombatesService {
  /** Mismo propósito que en BloquesService: evitar generaciones duplicadas por doble clic o pestañas paralelas. */
  private readonly generandoPorTorneo = new Set<string>();

  constructor(
    @InjectModel(Combate.name)
    private readonly combateModel: Model<CombateDocument>,
    @InjectModel(Bloque.name)
    private readonly bloqueModel: Model<BloqueDocument>,
    @InjectModel(Dojo.name) private readonly dojoModel: Model<DojoDocument>,
    private readonly asignaciones: AsignacionesStaffService,
  ) {}

  async actualizarHorario(
    torneoId: string,
    combateId: string,
    dto: ActualizarHorarioCombateDto,
  ): Promise<CombateDocument> {
    if (
      !Types.ObjectId.isValid(torneoId) ||
      !Types.ObjectId.isValid(combateId)
    ) {
      throw new BadRequestException(
        'El identificador del torneo o del combate no es válido.',
      );
    }

    const valor = dto.horarioProgramado;

    // También valida aquí antes de modificar la base de datos.
    if (
      valor !== null &&
      (typeof valor !== 'string' ||
        !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(valor) ||
        !Number.isFinite(Date.parse(valor)))
    ) {
      throw new BadRequestException(
        'Debes indicar una fecha y hora válidas con zona horaria.',
      );
    }

    const combate = await this.combateModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(combateId),
          torneo: new Types.ObjectId(torneoId),
        },
        {
          $set: {
            horarioProgramado: valor === null ? null : new Date(valor),
          },
        },
        {
          new: true,
          runValidators: true,
        },
      )
      .populate(POPULATE)
      .exec();

    if (!combate) {
      throw new NotFoundException('El combate no existe en este torneo.');
    }

    return combate;
  }

  async findByTorneo(
    torneoId: string,
    filters?: {
      bloque?: string;
      dojo?: string;
      estado?: string;
      fase?: string;
    },
    user?: AuthenticatedUser,
  ): Promise<CombateDocument[]> {
    if (!Types.ObjectId.isValid(torneoId)) {
      throw new BadRequestException(
        'El identificador del torneo no es válido.',
      );
    }

    const torneoObjectId = new Types.ObjectId(torneoId);

    const query: Record<string, unknown> = {
      torneo: torneoObjectId,
    };

    if (filters?.bloque) {
      if (!Types.ObjectId.isValid(filters.bloque)) {
        throw new BadRequestException(
          'El identificador del bloque no es válido.',
        );
      }
      query['bloque'] = new Types.ObjectId(filters.bloque);
    }

    if (filters?.dojo) {
      if (!Types.ObjectId.isValid(filters.dojo)) {
        throw new BadRequestException(
          'El identificador del dojo no es válido.',
        );
      }
      query['dojo'] = new Types.ObjectId(filters.dojo);
    }

    if (filters?.estado) {
      query['estado'] = filters.estado;
    }

    if (filters?.fase) {
      query['fase'] = filters.fase;
    }

    console.log('[Combates] findByTorneo:', {
      torneoId,
      query,
      filters,
    });

    const totalSinPopulate = await this.combateModel
      .countDocuments(query)
      .exec();

    console.log(
      `[Combates] Encontrados antes de populate: ${totalSinPopulate}`,
    );

    const combates = await this.combateModel
      .find(query)
      .populate(POPULATE)
      .sort({
        turno: 1,
        arena: 1,
        bloque: 1,
        numero: 1,
      })
      .exec();

    console.log(`[Combates] Devueltos después de populate: ${combates.length}`);

    if (this.staffOnly(user)) {
      const asignaciones = await this.asignaciones.listar(torneoId, user!.id);
      const claves = new Set(asignaciones.map(a => `${a.dojo}:${a.fecha}`));
      return combates.filter(c => {
        const dojoId = (c.dojo as any)?._id?.toString() ?? c.dojo?.toString();
        // Sin horario programado se usa la fecha de hoy (jornada actual).
        const fechaCombate = c.horarioProgramado ?? new Date();
        return claves.has(`${dojoId}:${this.asignaciones.fechaLocal(fechaCombate)}`);
      });
    }
    return combates;
  }

  private staffOnly(user?: AuthenticatedUser): boolean {
    return !!user?.roles.includes('STAFF' as any) && !user.roles.includes('ADMIN' as any);
  }
  private async verificarAcceso(c: CombateDocument, user?: AuthenticatedUser) {
    if (this.staffOnly(user)) {
      await this.asignaciones.exigir(user!.id, c.torneo.toString(),
        (c.dojo as any)?._id?.toString() ?? c.dojo?.toString() ?? '',
        c.horarioProgramado ?? new Date());
    }
  }

  async findOne(id: string, user?: AuthenticatedUser): Promise<CombateDocument> {
    const combate = await this.combateModel
      .findById(id)
      .populate(POPULATE)
      .exec();
    if (!combate) throw new NotFoundException('Combate no encontrado');
    await this.verificarAcceso(combate, user);
    return combate;
  }

  /** Genera los enfrentamientos round-robin (todos contra todos) de uno o todos los bloques del torneo. */
  async generar(
    torneoId: string,
    dto: GenerarCombatesDto,
  ): Promise<CombateDocument[]> {
    const lockKey = `${torneoId}:${dto.fase ?? FaseCombate.FASE_GRUPOS}`;

    if (this.generandoPorTorneo.has(lockKey)) {
      throw new ConflictException(
        'Ya se están generando los enfrentamientos de este torneo. Espera a que termine.',
      );
    }

    this.generandoPorTorneo.add(lockKey);

    try {
      return await this.generarInterno(torneoId, dto);
    } finally {
      this.generandoPorTorneo.delete(lockKey);
    }
  }

  private async generarInterno(
    torneoId: string,
    dto: GenerarCombatesDto,
  ): Promise<CombateDocument[]> {
    if (!Types.ObjectId.isValid(torneoId)) {
      throw new BadRequestException('El ID del torneo no es válido.');
    }

    const torneoObjectId = new Types.ObjectId(torneoId);
    const fase = dto.fase ?? FaseCombate.FASE_GRUPOS;

    if (fase !== FaseCombate.FASE_GRUPOS) {
      throw new BadRequestException(
        'Este generador es únicamente para la fase de grupos.',
      );
    }

    const filtroBloques: Record<string, unknown> = {
      torneo: torneoObjectId,
    };

    const idsSolicitados = dto.bloqueIds?.length
      ? dto.bloqueIds
      : dto.bloqueId
        ? [dto.bloqueId]
        : [];

    if (idsSolicitados.some((id) => !Types.ObjectId.isValid(id))) {
      throw new BadRequestException('Hay identificadores de bloque inválidos.');
    }

    if (idsSolicitados.length > 0) {
      filtroBloques._id = {
        $in: idsSolicitados.map((id) => new Types.ObjectId(id)),
      };
    }

    const bloques = await this.bloqueModel.find(filtroBloques).exec();

    if (bloques.length === 0) {
      throw new BadRequestException(
        'No hay bloques generados para este torneo.',
      );
    }

    if (
      idsSolicitados.length > 0 &&
      bloques.length !== new Set(idsSolicitados).size
    ) {
      throw new BadRequestException(
        'Alguno de los bloques no existe o no pertenece al torneo.',
      );
    }

    bloques.sort(
      (a, b) =>
        a.nombre.length - b.nombre.length || a.nombre.localeCompare(b.nombre),
    );

    // Impide borrar resultados o combates en curso al regenerar.
    const iniciados = await this.combateModel.exists({
      torneo: torneoObjectId,
      fase,
      estado: { $ne: EstadoCombate.PENDIENTE },
    });

    if (iniciados) {
      throw new ConflictException(
        'La fase de grupos ya comenzó y no puede regenerarse.',
      );
    }

    const documentos: Record<string, unknown>[] = [];
    const robotsVistos = new Set<string>();

    for (const bloque of bloques) {
      const robots = bloque.robots.map((id) => new Types.ObjectId(String(id)));

      for (const robot of robots) {
        const id = robot.toString();

        if (robotsVistos.has(id)) {
          throw new BadRequestException(
            'Hay un robot repetido en los bloques seleccionados.',
          );
        }

        robotsVistos.add(id);
      }

      // Un bloque de un robot no genera combates.
      if (robots.length < 2) continue;

      const lista: Array<Types.ObjectId | null> = [...robots];

      if (lista.length % 2 !== 0) {
        lista.push(null);
      }

      // Prepara el método circular para comenzar
      const participantes: Array<Types.ObjectId | null> = [
        ...lista.filter((_, indice) => indice % 2 === 0),
        ...lista.filter((_, indice) => indice % 2 !== 0).reverse(),
      ];

      const totalRondas = participantes.length - 1;
      const mitad = participantes.length / 2;
      let numero = 1;

      for (let ronda = 1; ronda <= totalRondas; ronda++) {
        for (let indice = 0; indice < mitad; indice++) {
          const robot1 = participantes[indice];
          const robot2 = participantes[participantes.length - 1 - indice];

          if (robot1 === null || robot2 === null) {
            continue;
          }

          documentos.push({
            torneo: torneoObjectId,
            bloque: bloque._id,
            fase,
            numero: numero++,
            ronda,
            robot1,
            robot2,
            dojo: null,
            turno: null,
            arena: null,
            estado: EstadoCombate.PENDIENTE,
          });
        }

        // Método circular: fija el primero y rota los restantes hacia la izquierda.
        const [segundo] = participantes.splice(1, 1);
        participantes.push(segundo);
      }
    }

    if (documentos.length === 0) {
      throw new BadRequestException(
        'Se necesitan al menos dos robots en algún bloque para generar combates.',
      );
    }

    // Al seleccionar bloques concretos, conserva los demás.
    await this.combateModel
      .deleteMany({
        torneo: torneoObjectId,
        fase,
        ...(idsSolicitados.length > 0
          ? { bloque: { $in: bloques.map((bloque) => bloque._id) } }
          : {}),
      })
      .exec();

    const creados = await this.combateModel.insertMany(documentos);

    const ids: Types.ObjectId[] = creados.map(
      (combate) => new Types.ObjectId(String(combate._id)),
    );

    return this.combateModel
      .find({ _id: { $in: ids } })
      .populate(POPULATE)
      .sort({ ronda: 1, bloque: 1, numero: 1 })
      .exec();
  }

  /** Resumen de ocupación de cada dojo dentro de un torneo (para la pantalla de asignación). */
  async resumenDojos(
    torneoId: string,
  ): Promise<{ dojo: DojoDocument; combatesAsignados: number }[]> {
    const dojos = await this.dojoModel.find().sort({ nombre: 1 }).exec();

    const resultados = await Promise.all(
      dojos.map(async (dojo) => {
        const combatesAsignados = await this.combateModel
          .countDocuments({
            torneo: torneoId,
            dojo: dojo._id,
            estado: { $ne: EstadoCombate.FINALIZADO },
          })
          .exec();
        return { dojo, combatesAsignados };
      }),
    );

    return resultados;
  }

  async crearCombatesEliminatorios(
    torneoId: string,
    fase: FaseCombate,
    participantes: Array<{
      robotId: string;
      seed?: number;
    }>,
  ): Promise<CombateDocument[]> {
    if (participantes.length < 2) {
      throw new BadRequestException(
        'No hay suficientes participantes para crear la ronda.',
      );
    }

    if (participantes.length % 2 !== 0) {
      throw new BadRequestException(
        'La cantidad de participantes debe ser par.',
      );
    }

    const existentes = await this.combateModel
      .find({ torneo: torneoId, fase })
      .populate(POPULATE)
      .sort({ numero: 1 })
      .exec();

    // Evita duplicar la ronda si se presiona dos veces.
    if (existentes.length > 0) {
      return existentes;
    }

    const documentos: Array<Record<string, unknown>> = [];

    let izquierda = 0;
    let derecha = participantes.length - 1;
    let numero = 1;

    /*
     * Emparejamiento:
     * seed 1 vs último seed
     * seed 2 vs penúltimo seed
     * etc.
     */
    while (izquierda < derecha) {
      const robot1 = participantes[izquierda];
      const robot2 = participantes[derecha];

      documentos.push({
        torneo: new Types.ObjectId(torneoId),
        robot1: new Types.ObjectId(robot1.robotId),
        robot2: new Types.ObjectId(robot2.robotId),
        fase,
        estado: EstadoCombate.PENDIENTE,
        numero,
        dojo: null,
        turno: null,
        arena: null,
        resultado: null,
      });

      izquierda += 1;
      derecha -= 1;
      numero += 1;
    }

    await this.combateModel.insertMany(documentos);

    return this.combateModel
      .find({
        torneo: new Types.ObjectId(torneoId),
        fase,
      })
      .populate(POPULATE)
      .sort({ numero: 1 })
      .exec();
  }

  async registrarResultadosAleatorios(
    torneoId: string,
    fase?: FaseCombate,
  ): Promise<{ actualizados: number }> {
    if (!Types.ObjectId.isValid(torneoId)) {
      throw new BadRequestException(
        'El identificador del torneo no es válido.',
      );
    }

    const filtro: Record<string, unknown> = {
      torneo: new Types.ObjectId(torneoId),
      estado: {
        $in: [EstadoCombate.PENDIENTE, EstadoCombate.EN_CURSO],
      },
    };

    if (fase) {
      filtro.fase = fase;
    }

    const combates = await this.combateModel.find(filtro).exec();

    if (combates.length === 0) {
      return { actualizados: 0 };
    }

    const operaciones = combates.map((combate) => {
      const resultado =
        Math.random() < 0.5
          ? ResultadoCombate.GANA_ROBOT_1
          : ResultadoCombate.GANA_ROBOT_2;

      const duracionSegundos = Math.floor(Math.random() * 151) + 30;

      return {
        updateOne: {
          filter: { _id: combate._id },
          update: {
            $set: {
              estado: EstadoCombate.FINALIZADO,
              resultado,
              metodoVictoria: MetodoVictoria.PUNTOS,
              duracionSegundos,
              observaciones: 'Resultado generado automáticamente para pruebas.',
            },
          },
        },
      };
    });

    const resultadoActualizacion =
      await this.combateModel.bulkWrite(operaciones);

    return {
      actualizados: resultadoActualizacion.modifiedCount,
    };
  }

  async generarRondaEliminatoria(
    torneoId: string,
    fase: FaseCombate,
    cruces: Array<{
      numero: number;
      robot1Id: string;
      robot2Id: string;
    }>,
  ): Promise<CombateDocument[]> {
    if (!Types.ObjectId.isValid(torneoId)) {
      throw new BadRequestException(
        'El identificador del torneo no es válido.',
      );
    }

    if (cruces.length === 0) {
      throw new BadRequestException(
        'No existen cruces preliminares para generar.',
      );
    }

    for (const cruce of cruces) {
      if (
        !Types.ObjectId.isValid(cruce.robot1Id) ||
        !Types.ObjectId.isValid(cruce.robot2Id)
      ) {
        throw new BadRequestException(
          'Uno de los robots clasificados no es válido.',
        );
      }

      if (cruce.robot1Id === cruce.robot2Id) {
        throw new BadRequestException(
          'Un robot no puede enfrentarse contra sí mismo.',
        );
      }
    }

    const torneoObjectId = new Types.ObjectId(torneoId);

    // Permite regenerar la ronda antes de comenzar, evitando enfrentamientos duplicados.
    const octavosExistentes = await this.combateModel.find({
      torneo: torneoObjectId,
      fase,
    });

    const yaIniciados = octavosExistentes.some(
      (combate) => combate.estado !== EstadoCombate.PENDIENTE,
    );

    if (yaIniciados) {
      throw new ConflictException(
        'La fase eliminatoria ya comenzó y no puede regenerarse.',
      );
    }

    await this.combateModel.deleteMany({
      torneo: torneoObjectId,
      fase: FaseCombate.OCTAVOS,
    });

    await this.combateModel.insertMany(
      cruces.map((cruce) => ({
        torneo: torneoObjectId,
        bloque: null,
        fase,
        numero: cruce.numero,
        robot1: new Types.ObjectId(cruce.robot1Id),
        robot2: new Types.ObjectId(cruce.robot2Id),
        dojo: null,
        turno: null,
        arena: null,
        estado: EstadoCombate.PENDIENTE,
        resultado: null,
        metodoVictoria: null,
        duracionSegundos: null,
        jueces: [],
        observaciones: 'Ronda preliminar de la fase eliminatoria.',
        historial: [
          {
            hora: new Date(),
            descripcion: 'Combate preliminar generado automáticamente.',
            tipo: 'info',
          },
        ],
      })),
    );

    return this.combateModel
      .find({ torneo: torneoObjectId, fase })
      .populate(POPULATE)
      .sort({ numero: 1 })
      .exec();
  }

  async asignarDojo(id: string, dto: AsignarDojoDto): Promise<CombateDocument> {
    const dojo = await this.dojoModel.findById(dto.dojo).exec();
    if (!dojo) throw new NotFoundException('Dojo no encontrado');

    const combate = await this.combateModel.findById(id).exec();
    if (!combate) throw new NotFoundException('Combate no encontrado');

    const ocupados = await this.combateModel
      .countDocuments({
        torneo: combate.torneo,
        dojo: dojo._id,
        estado: { $ne: EstadoCombate.FINALIZADO },
        _id: { $ne: combate._id },
      })
      .exec();

    if (ocupados >= dojo.capacidad) {
      throw new BadRequestException(
        `El dojo "${dojo.nombre}" ya alcanzó su capacidad máxima (${dojo.capacidad} combates).`,
      );
    }

    combate.dojo = dojo._id as unknown as Types.ObjectId;
    await combate.save();

    return this.combateModel
      .findById(id)
      .populate(POPULATE)
      .exec() as Promise<CombateDocument>;
  }

  async quitarDojo(id: string): Promise<CombateDocument> {
    const combate = await this.combateModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            dojo: null,
            turno: null,
            arena: null,
          },
        },
        { new: true },
      )
      .populate(POPULATE)
      .exec();

    if (!combate) throw new NotFoundException('Combate no encontrado');
    return combate;
  }

  /** Reparte automáticamente los combates pendientes sin dojo entre los dojos disponibles, respetando su capacidad. */
    async asignarDojosAutomatico(
    torneoId: string,
    fase?: string,
    dojoIds?: string[],
  ): Promise<CombateDocument[]> {
    if (!Types.ObjectId.isValid(torneoId)) {
      throw new BadRequestException(
        'El ID del torneo no es válido.',
      );
    }

    const torneoObjectId = new Types.ObjectId(torneoId);
    const faseSeleccionada =
      fase ?? FaseCombate.FASE_GRUPOS;

    if (
      !Object.values(FaseCombate).includes(
        faseSeleccionada as FaseCombate,
      )
    ) {
      throw new BadRequestException(
        'La fase del torneo no es válida.',
      );
    }

    const filtro = {
      torneo: torneoObjectId,
      fase: faseSeleccionada as FaseCombate,
    };

    const combates = await this.combateModel
      .find(filtro)
      .exec();

    if (combates.length === 0) {
      throw new BadRequestException(
        'No hay combates para asignar en esta fase.',
      );
    }

    if (
      combates.some(
        (combate) =>
          combate.estado !== EstadoCombate.PENDIENTE,
      )
    ) {
      throw new ConflictException(
        'La fase ya comenzó. No se puede reorganizar automáticamente.',
      );
    }

    const esGrupos =
      faseSeleccionada === FaseCombate.FASE_GRUPOS;

    if (
      esGrupos &&
      combates.some(
        (combate) =>
          !Number.isInteger(combate.ronda) ||
          (combate.ronda ?? 0) < 1,
      )
    ) {
      throw new BadRequestException(
        'Hay combates sin ronda registrada. Revisa sus datos antes de asignar dojos.',
      );
    }

    // Permite elegir los dojos que utilizará cada torneo.
    if (
      dojoIds !== undefined &&
      (
        !Array.isArray(dojoIds) ||
        dojoIds.length === 0 ||
        dojoIds.some(
          (id) =>
            typeof id !== 'string' ||
            !Types.ObjectId.isValid(id),
        )
      )
    ) {
      throw new BadRequestException(
        'Selecciona al menos un dojo válido.',
      );
    }

    const idsSeleccionados =
      dojoIds === undefined
        ? null
        : [
            ...new Set(
              dojoIds.map((id) =>
                new Types.ObjectId(id).toHexString(),
              ),
            ),
          ];

    const dojos = await this.dojoModel
      .find({
        estado: {
          $ne: EstadoDojo.MANTENIMIENTO,
        },
        ...(idsSeleccionados
          ? {
              _id: {
                $in: idsSeleccionados.map(
                  (id) => new Types.ObjectId(id),
                ),
              },
            }
          : {}),
      })
      .exec();

    if (
      idsSeleccionados &&
      dojos.length !== idsSeleccionados.length
    ) {
      throw new BadRequestException(
        'Algún dojo seleccionado no existe o está en mantenimiento.',
      );
    }

    if (dojos.length === 0) {
      throw new BadRequestException(
        'No hay dojos disponibles para asignar.',
      );
    }

    if (
      dojos.some(
        (dojo) =>
          !Number.isInteger(dojo.capacidad) ||
          dojo.capacidad < 1,
      )
    ) {
      throw new BadRequestException(
        'Los dojos seleccionados deben tener al menos una arena.',
      );
    }

    // Orden natural: Dojo 1, Dojo 2, ... Dojo 10.
    dojos.sort(
      (a, b) =>
        a.nombre.localeCompare(b.nombre, 'es', {
          numeric: true,
          sensitivity: 'base',
        }) ||
        String(a._id).localeCompare(String(b._id)),
    );

    // El orden de los grupos depende de su nombre,
    // no del ObjectId que MongoDB les asignó.
    const bloques = await this.bloqueModel
      .find({ torneo: torneoObjectId })
      .select('nombre')
      .exec();

    const nombresBloques = new Map<string, string>(
      bloques.map(
        (bloque): [string, string] => [
          String(bloque._id),
          bloque.nombre,
        ],
      ),
    );

    combates.sort((a, b) => {
      if (esGrupos) {
        const porRonda =
          (a.ronda ?? 0) - (b.ronda ?? 0);

        if (porRonda) return porRonda;

        const grupoA =
          nombresBloques.get(String(a.bloque)) ?? '';

        const grupoB =
          nombresBloques.get(String(b.bloque)) ?? '';

        const porGrupo =
          grupoA.length - grupoB.length ||
          grupoA.localeCompare(grupoB, 'es', {
            numeric: true,
          });

        if (porGrupo) return porGrupo;
      }

      return (
        a.numero - b.numero ||
        String(a._id).localeCompare(String(b._id))
      );
    });

    const porRonda =
      new Map<number, CombateDocument[]>();

    for (const combate of combates) {
      const ronda = esGrupos ? combate.ronda! : 1;
      const lista = porRonda.get(ronda) ?? [];

      lista.push(combate);
      porRonda.set(ronda, lista);
    }

    const operaciones:
      Parameters<typeof this.combateModel.bulkWrite>[0] = [];

    let siguienteTurno = 1;

    for (const lista of porRonda.values()) {
      const cantidadDojos = dojos.length;

      // Verifica que un robot no aparezca dos veces
      // en la misma tanda antes de guardar cambios.
      for (
        let inicio = 0;
        inicio < lista.length;
        inicio += cantidadDojos
      ) {
        const robotsOcupados = new Set<string>();

        const tanda = lista.slice(
          inicio,
          inicio + cantidadDojos,
        );

        for (const combate of tanda) {
          const robots = [
            combate.robot1,
            combate.robot2,
          ].filter(
            (robot): robot is Types.ObjectId =>
              robot !== null && robot !== undefined,
          );

          for (const robot of robots) {
            const id = String(robot);

            if (robotsOcupados.has(id)) {
              throw new BadRequestException(
                'Un robot aparece en dos combates de la misma tanda. Revisa el orden antes de asignar.',
              );
            }

            robotsOcupados.add(id);
          }
        }
      }

      lista.forEach((combate, indice) => {
        // Cada ronda comienza en el primer dojo.
        const dojo =
          dojos[indice % cantidadDojos];

        const turno =
          siguienteTurno +
          Math.floor(indice / cantidadDojos);

        operaciones.push({
          updateOne: {
            filter: {
              _id: combate._id,
              torneo: torneoObjectId,
              fase: faseSeleccionada as FaseCombate,
              estado: EstadoCombate.PENDIENTE,
            },
            update: {
              $set: {
                dojo: dojo._id,
                arena: 1,
                turno,
              },
            },
          },
        });
      });

      siguienteTurno += Math.ceil(
        lista.length / cantidadDojos,
      );
    }

    // No modifica horarioProgramado ni los cruces.
    await this.combateModel.bulkWrite(
      operaciones,
      { ordered: true },
    );

    const actualizados = await this.combateModel
      .find(filtro)
      .populate(POPULATE)
      .exec();

    // Devuelve el mismo orden utilizado al asignar.
    const posiciones = new Map(
      combates.map((combate, indice) => [
        String(combate._id),
        indice,
      ]),
    );

    return actualizados.sort(
      (a, b) =>
        (posiciones.get(String(a._id)) ?? 0) -
        (posiciones.get(String(b._id)) ?? 0),
    );
  }

  async iniciar(id: string, user?: AuthenticatedUser): Promise<CombateDocument> {
    const combate = await this.combateModel.findById(id).exec();
    if (!combate) throw new NotFoundException('Combate no encontrado');

    await this.verificarAcceso(combate, user);
    if (!combate.robot1 || !combate.robot2) {
      throw new BadRequestException(
        'No se puede iniciar el combate hasta que estén definidos ambos robots.',
      );
    }
    if (combate.estado === EstadoCombate.FINALIZADO) {
      throw new BadRequestException('Este combate ya fue finalizado');
    }

    const actualizado = await this.combateModel.findOneAndUpdate(
      { _id: id, estado: { $ne: EstadoCombate.FINALIZADO }, resultado: null },
      { $set: { estado: EstadoCombate.EN_CURSO },
        $push: { historial: { hora: new Date(), descripcion: 'Combate iniciado', tipo: 'info' } } },
      { new: true, runValidators: true },
    ).populate(POPULATE).exec();
    if (!actualizado) throw new ConflictException('El combate ya tiene un resultado');
    return actualizado;
  }

  async registrarResultado(
    id: string, dto: RegistrarResultadoDto, user?: AuthenticatedUser,
  ): Promise<CombateDocument> {
    const combate = await this.combateModel.findById(id).exec();
    if (!combate) throw new NotFoundException('Combate no encontrado');
    await this.verificarAcceso(combate, user);
    if (!combate.robot1 || !combate.robot2) {
      throw new BadRequestException(
        'No se puede registrar el resultado hasta que estén definidos ambos robots.',
      );
    }
    if (!dto.metodoVictoria || (dto.metodoVictoria === MetodoVictoria.OTRO && !dto.otroMetodoVictoria?.trim())) {
      throw new BadRequestException('Selecciona el método de victoria y especifica Otro cuando corresponda');
    }
    // Una sola escritura condicional atómica: el segundo STAFF no puede sobrescribir el primero.
    const actualizado = await this.combateModel.findOneAndUpdate(
      { _id: id, estado: { $ne: EstadoCombate.FINALIZADO }, resultado: null },
      {
        $set: {
          resultado: dto.resultado, estado: EstadoCombate.FINALIZADO,
          metodoVictoria: dto.metodoVictoria,
          otroMetodoVictoria: dto.metodoVictoria === MetodoVictoria.OTRO ? dto.otroMetodoVictoria!.trim() : null,
          duracionSegundos: dto.duracionSegundos ?? null, jueces: dto.jueces ?? [],
          observaciones: dto.observaciones ?? '',
        },
        $push: { historial: { hora: new Date(), descripcion: `Combate finalizado — ${dto.resultado}`,
          tipo: 'success' } },
      }, { new: true, runValidators: true },
    ).populate(POPULATE).exec();
    if (!actualizado) throw new ConflictException(
      'Este combate ya tiene un resultado registrado. Actualiza la lista para consultarlo.');
    return actualizado;
  }

  async cancelar(id: string): Promise<CombateDocument> {
    const combate = await this.combateModel.findById(id).exec();
    if (!combate) throw new NotFoundException('Combate no encontrado');

    combate.estado = EstadoCombate.PENDIENTE;
    combate.resultado = null;
    combate.metodoVictoria = null;
    combate.duracionSegundos = null;
    combate.historial.push({
      hora: new Date(),
      descripcion: 'Combate cancelado y reiniciado a pendiente',
      tipo: 'warning',
    });
    await combate.save();

    return this.combateModel
      .findById(id)
      .populate(POPULATE)
      .exec() as Promise<CombateDocument>;
  }

  /** Conteo global (todos los torneos) para las tarjetas del dashboard. */
  async statsGlobal(): Promise<{ total: number; finalizados: number }> {
    const [total, finalizados] = await Promise.all([
      this.combateModel.countDocuments().exec(),
      this.combateModel
        .countDocuments({ estado: EstadoCombate.FINALIZADO })
        .exec(),
    ]);

    return { total, finalizados };
  }
}
