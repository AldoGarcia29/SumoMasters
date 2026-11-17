import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { MongoServerError } from 'mongodb';
import { Model, Types } from 'mongoose';
import { CreateTorneoDto } from './dto/create-torneo.dto';
import { UpdateTorneoDto } from './dto/update-torneo.dto';
import { Torneo, TorneoDocument } from './schemas/torneo.schema';
import { PublicCacheService } from '../public/public-cache.service';
import { UpdateHorarioDto } from '../public/dto/update-horario.dto';
import { LISTA_KEY, liveKey } from '../public/public.constants';
import { PublicService } from '../public/public.service';
import { Equipo } from '../equipos/schemas/equipo.schema';
import { randomInt } from 'node:crypto';
import { TipoCombate } from '../categorias/enums/categoria.enums';
import { generarGruposRoboSoccer } from './robo-soccer/generar-grupos';
import { RegistrarResultadoGrupoDto } from './dto/registrar-resultado-grupo.dto';
import { construirLlave } from './robo-soccer/llaves-robo-soccer';
import { GuardarLlaveRoboSoccerDto } from './dto/guardar-llave-robo-soccer.dto';


const POPULATE = [
  { path: 'categoria', select: 'nombre tipoCombate' },
  { path: 'equiposInscritos', select: 'nombre' },
  {
    path: 'robotsInscritos',
    select: 'nombre imagenUrl equipo pesoKg createdAt',
    populate: { path: 'equipo', select: 'nombre' },
  },
  { path: 'participantes.robot', select: 'nombre imagenUrl equipo pesoKg' },
];

@Injectable()
export class TorneosService {
  constructor(
    @InjectModel(Torneo.name)
    private readonly torneoModel: Model<TorneoDocument>,
    @InjectModel(Equipo.name)
    private readonly equipoModel: Model<Equipo>,
    private readonly publicCache: PublicCacheService,
    private readonly publicService: PublicService,
  ) {}

  async generarGrupos(id: string, cantidadGrupos: number) {
    const torneo = await this.torneoModel
      .findById(id)
      .populate({ path: 'categoria', select: 'tipoCombate' })
      .exec();

    if (!torneo) throw new NotFoundException('Torneo no encontrado');

    const categoria = torneo.categoria as unknown as {
      _id: Types.ObjectId;
      tipoCombate: TipoCombate;
    } | null;

    if (categoria?.tipoCombate !== TipoCombate.ROBO_SOCCER_RC) {
      throw new BadRequestException(
        'La generación de grupos corresponde a torneos de Robo Soccer RC',
      );
    }

    const registro = await this.torneoModel.collection.findOne(
      { _id: torneo._id },
      { projection: { categoria: 1, equiposInscritos: 1, gruposRoboSoccer: 1 } },
    );

    if (!registro) throw new NotFoundException('Torneo no encontrado');

    if (registro.categoria?.toString() !== categoria._id.toString()) {
      throw new ConflictException('La categoría cambió durante la generación');
    }

    if (registro.gruposRoboSoccer?.length) {
      return { grupos: registro.gruposRoboSoccer };
    }

    const equiposGuardados: (Types.ObjectId | string)[] =
      registro.equiposInscritos ?? [];
    const ordenSorteado = equiposGuardados.map((equipoId) => equipoId.toString());

    for (let indice = ordenSorteado.length - 1; indice > 0; indice--) {
      const destino = randomInt(indice + 1);
      [ordenSorteado[indice], ordenSorteado[destino]] = [
        ordenSorteado[destino],
        ordenSorteado[indice],
      ];
    }

    const grupos = generarGruposRoboSoccer(ordenSorteado, cantidadGrupos);

    const guardado = await this.torneoModel.collection.updateOne(
      {
        _id: registro._id,
        categoria: registro.categoria,
        equiposInscritos: { $eq: equiposGuardados },
        'gruposRoboSoccer.0': { $exists: false },
      },
      { $set: { gruposRoboSoccer: grupos, updatedAt: new Date() } },
    );

    if (guardado.matchedCount === 0) {
      const actual = await this.torneoModel.collection.findOne(
        { _id: registro._id, categoria: registro.categoria },
        { projection: { gruposRoboSoccer: 1 } },
      );

      if (actual?.gruposRoboSoccer?.length) {
        return { grupos: actual.gruposRoboSoccer };
      }

      throw new ConflictException(
        'La inscripción o la categoría cambió durante la generación de grupos',
      );
    }

    this.invalidatePublicData(id);
    return { grupos };
  }

  async create(dto: CreateTorneoDto): Promise<TorneoDocument> {
    await this.validarEquiposInscritos(
      dto.categoria,
      dto.equiposInscritos ?? [],
    );
    const torneo = new this.torneoModel({
      ...dto,
      robotsInscritos: [],
      nombre: dto.nombre.trim(),
    });

    try {
      await torneo.save();
      await this.inscribirRobots(torneo.id, dto.robotsInscritos ?? []);
      this.invalidatePublicData(torneo.id);
      const creado = await this.torneoModel
        .findById(torneo.id)
        .populate(POPULATE)
        .exec();
      if (!creado) throw new NotFoundException('Torneo no encontrado');
      return creado;
    } catch (error: unknown) {
      this.handleDuplicateKeyError(error);
      throw error;
    }
  }

  async findAll(filters?: {
    search?: string;
    estado?: string;
    categoria?: string;
  }): Promise<TorneoDocument[]> {
    const query: Record<string, unknown> = {};

    if (filters?.estado) query.estado = filters.estado;
    if (filters?.categoria) query.categoria = filters.categoria;
    if (filters?.search) {
      query.nombre = { $regex: filters.search, $options: 'i' };
    }

    return this.torneoModel
      .find(query)
      .populate(POPULATE)
      .sort({ fecha: -1 })
      .exec();
  }

  async findOne(id: string): Promise<TorneoDocument> {
    const torneo = await this.torneoModel
      .findById(id)
      .populate(POPULATE)
      .exec();

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado');
    }

    return torneo;
  }

  async update(id: string, dto: UpdateTorneoDto): Promise<TorneoDocument> {
    try {
      if (dto.equiposInscritos !== undefined || dto.categoria !== undefined) {
        const actual = await this.torneoModel
          .findById(id)
          .select('categoria equiposInscritos')
          .exec();

        if (!actual) throw new NotFoundException('Torneo no encontrado');

        await this.validarEquiposInscritos(
          dto.categoria ?? actual.categoria.toString(),
          dto.equiposInscritos ??
            (actual.equiposInscritos ?? []).map((equipo) => equipo.toString()),
        );
      }
      if (dto.robotsInscritos !== undefined) {
        await this.inscribirRobots(id, dto.robotsInscritos);
      }

      const { robotsInscritos, ...campos } = dto;
      const torneo = await this.torneoModel
        .findByIdAndUpdate(
          id,
          {
            $set: {
              ...campos,
              ...(robotsInscritos !== undefined
                ? { robotsInscritos }
                : {}),
            },
          },
          { returnDocument: 'after', runValidators: true },
        )
        .populate(POPULATE)
        .exec();

      if (!torneo) {
        throw new NotFoundException('Torneo no encontrado');
      }
      if (robotsInscritos !== undefined || dto.equiposInscritos !== undefined) {
        this.invalidatePublicData(id);
      }

      return torneo;
    } catch (error: unknown) {
      this.handleDuplicateKeyError(error);
      throw error;
    }
  }

  async fichaRobot(torneoId: string, robotId: string) {
    const ficha = await this.publicService.armarFichaRobot(
      torneoId,
      robotId,
      false,
    );
    if (!ficha) throw new NotFoundException('Robot o torneo no encontrado');
    return ficha;
  }

  private async validarEquiposInscritos(
    categoriaId: string,
    equipoIds: string[],
  ): Promise<void> {
    if (equipoIds.length === 0) return;

    const idsUnicos = new Set(equipoIds.map((id) => id.toLowerCase()));

    if (idsUnicos.size !== equipoIds.length) {
      throw new BadRequestException('Hay equipos repetidos en la inscripción');
    }

    const equiposValidos = await this.equipoModel.countDocuments({
      _id: { $in: [...idsUnicos] },
      categoria: categoriaId,
    }).exec();

    if (equiposValidos !== equipoIds.length) {
      throw new BadRequestException(
        'Uno o más equipos no existen o no pertenecen a la categoría del torneo',
      );
    }
  }

  private async inscribirRobots(
    torneoId: string,
    robotIds: string[],
  ): Promise<void> {
    const idsUnicos = [...new Set(robotIds)];
    for (const robotId of idsUnicos) {
      const id = new Types.ObjectId(robotId);
      const numero = { $add: [{ $ifNull: ['$ultimoNumero', 0] }, 1] };
      const actualizado = await this.torneoModel.findOneAndUpdate(
        {
          _id: torneoId,
          'participantes.robot': { $ne: id },
        },
        [
          {
            $set: {
              ultimoNumero: numero,
              robotsInscritos: {
                $setUnion: [{ $ifNull: ['$robotsInscritos', []] }, [id]],
              },
              participantes: {
                $concatArrays: [
                  { $ifNull: ['$participantes', []] },
                  [{ robot: id, numero }],
                ],
              },
            },
          },
        ],
        { returnDocument: 'after', updatePipeline: true },
      );

      if (actualizado) continue;

      const torneo = await this.torneoModel
        .findById(torneoId)
        .select('_id participantes')
        .lean()
        .exec();
      if (!torneo) throw new NotFoundException('Torneo no encontrado');
      if (!torneo.participantes?.some((p) => p.robot.equals(id))) {
        throw new ConflictException(
          `No se pudo asignar número al robot ${robotId}`,
        );
      }
    }
  }

  private invalidatePublicData(torneoId: string): void {
    this.publicCache.invalidate(liveKey(torneoId));
    this.publicCache.invalidate(LISTA_KEY);
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const result = await this.torneoModel.findByIdAndDelete(id).exec();

    if (!result) {
      throw new NotFoundException('Torneo no encontrado');
    }

    return { deleted: true };
  }

  private handleDuplicateKeyError(error: unknown): void {
    if (error instanceof MongoServerError && error.code === 11000) {
      throw new ConflictException('Ya existe un torneo con ese nombre');
    }
  }

  async actualizarHorario(id: string, dto: UpdateHorarioDto) {
    const update: Record<string, unknown> = {};
    if (dto.horaInicio !== undefined) {
      update.horaInicio =
        dto.horaInicio === null ? null : new Date(dto.horaInicio);
    }
    if (dto.duracionCombateMin !== undefined) {
      update.duracionCombateMin = dto.duracionCombateMin;
    }
    if (Object.keys(update).length === 0) {
      throw new BadRequestException('Nada que actualizar');
    }

    const t = await this.torneoModel.findByIdAndUpdate(id, update, {
      returnDocument: 'after',
    });
    if (!t) throw new NotFoundException('Torneo no encontrado');

    this.publicCache.invalidate(liveKey(id)); // el público ve el cambio al instante
    return {
      horaInicio: t.horaInicio,
      duracionCombateMin: t.duracionCombateMin,
    };
  }

  async cambiarVisibilidad(id: string, publico: boolean) {
    const t = await this.torneoModel.findByIdAndUpdate(
      id,
      { publico },
      { returnDocument: 'after' },
    );
    if (!t) throw new NotFoundException('Torneo no encontrado');

    this.publicCache.invalidate(liveKey(id));
    this.publicCache.invalidate(LISTA_KEY);
    return { publico: t.publico };
  }

  async registrarResultadoGrupo(
  id: string,
  numeroGrupo: number,
  dto: RegistrarResultadoGrupoDto,
) {
  if (!Types.ObjectId.isValid(id) || numeroGrupo < 1) {
    throw new BadRequestException('El torneo o el número de grupo no es válido');
  }

  const { golesLocal, golesVisitante } = dto;
  const cruce = {
    localId: dto.localId.toLowerCase(),
    visitanteId: dto.visitanteId.toLowerCase(),
  };
  const resultado = { golesLocal, golesVisitante };
  const torneoId = new Types.ObjectId(id);

  const guardado = await this.torneoModel.collection.updateOne(
    {
      _id: torneoId,
      gruposRoboSoccer: {
        $elemMatch: {
          numero: numeroGrupo,
          partidos: { $elemMatch: { ...cruce, resultado: null } },
        },
      },
    },
    {
      $set: {
        'gruposRoboSoccer.$[grupo].partidos.$[partido].resultado': resultado,
        updatedAt: new Date(),
      },
    },
    {
      arrayFilters: [
        { 'grupo.numero': numeroGrupo },
        {
          'partido.localId': cruce.localId,
          'partido.visitanteId': cruce.visitanteId,
          'partido.resultado': null,
        },
      ],
    },
  );

  if (guardado.matchedCount === 0) {
    const torneo = await this.torneoModel
      .findById(id)
      .select('gruposRoboSoccer')
      .lean()
      .exec();

    const partido = torneo?.gruposRoboSoccer
      ?.find((grupo) => grupo.numero === numeroGrupo)
      ?.partidos.find(
        (item) =>
          item.localId === cruce.localId &&
          item.visitanteId === cruce.visitanteId,
      );

    if (!partido) {
      throw new NotFoundException('Partido de grupo no encontrado');
    }

    // Si se reenvía el mismo marcador, devuelve el resultado guardado.
    if (
      partido.resultado?.golesLocal === golesLocal &&
      partido.resultado?.golesVisitante === golesVisitante
    ) {
      return { resultado: partido.resultado };
    }

    throw new ConflictException('Este partido ya tiene un resultado registrado');
  }

  this.invalidatePublicData(id);
  return { resultado };
}

async consultarLlaveRoboSoccer(id: string) {
  const { equipoIds, llave } = await this.leerLlaveRoboSoccer(id);

  return {
    llave,
    cuadro: llave
      ? construirLlave(equipoIds, llave.rondaInicial, llave.crucesIniciales, llave.decisiones)
      : null,
  };
}

async guardarLlaveRoboSoccer(id: string, dto: GuardarLlaveRoboSoccerDto) {
  const { registro, equipoIds, llave } = await this.leerLlaveRoboSoccer(id);

  const crucesIniciales = dto.crucesIniciales.map(({ localId, visitanteId }) => ({
    localId: localId?.toLowerCase() ?? null,
    visitanteId: visitanteId?.toLowerCase() ?? null,
  }));

  const cuadro = construirLlave(
    equipoIds,
    dto.rondaInicial,
    crucesIniciales,
    llave?.decisiones ?? {},
  );

  const actualizada = {
    rondaInicial: dto.rondaInicial,
    crucesIniciales,
    decisiones: cuadro.decisionesValidas,
  };

  await this.persistirLlaveRoboSoccer(registro, actualizada);
  return { llave: actualizada, cuadro };
}

async elegirGanadorRoboSoccer(id: string, cruceId: string, ganadorId: string) {
  const { registro, equipoIds, llave } = await this.leerLlaveRoboSoccer(id);

  if (!llave) {
    throw new NotFoundException('Primero guarda la llave del torneo.');
  }

  const cuadroActual = construirLlave(
    equipoIds, llave.rondaInicial, llave.crucesIniciales, llave.decisiones,
  );
  const cruce = [
    ...cuadroActual.rondas.flatMap(({ cruces }) => cruces),
    ...(cuadroActual.tercerLugar ? [cuadroActual.tercerLugar] : []),
  ].find((item) => item.id === cruceId);

  if (!cruce) throw new NotFoundException('Cruce no encontrado.');

  const { localId, visitanteId } = cruce;
  const ganador = ganadorId.toLowerCase();

  if (!localId || !visitanteId || (ganador !== localId && ganador !== visitanteId)) {
    throw new BadRequestException('Elige a uno de los dos equipos de este cruce.');
  }

  const cuadro = construirLlave(
    equipoIds,
    llave.rondaInicial,
    llave.crucesIniciales,
    {
      ...cuadroActual.decisionesValidas,
      [cruceId]: { localId, visitanteId, ganadorId: ganador },
    },
  );

  const actualizada = { ...llave, decisiones: cuadro.decisionesValidas };

  await this.persistirLlaveRoboSoccer(registro, actualizada);
  return { llave: actualizada, cuadro };
}

private async leerLlaveRoboSoccer(id: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw new BadRequestException('El identificador del torneo no es válido.');
  }

  const registro = await this.torneoModel.collection.findOne(
    { _id: new Types.ObjectId(id) },
    { projection: { categoria: 1, equiposInscritos: 1, llaveRoboSoccer: 1 } },
  );

  if (!registro) throw new NotFoundException('Torneo no encontrado.');

  const torneo = await this.torneoModel
    .findById(id)
    .select('categoria')
    .populate<{ categoria: { _id: Types.ObjectId; tipoCombate: TipoCombate } | null }>({
      path: 'categoria',
      select: 'tipoCombate',
    })
    .exec();

  if (
    torneo?.categoria?.tipoCombate !== TipoCombate.ROBO_SOCCER_RC ||
    torneo.categoria._id.toString() !== registro.categoria.toString()
  ) {
    throw new BadRequestException('La llave corresponde a un torneo de Robo Soccer RC.');
  }

  const equipos: (Types.ObjectId | string)[] = registro.equiposInscritos ?? [];

  return {
    registro,
    equipoIds: equipos.map((equipo) => equipo.toString().toLowerCase()),
    llave: (registro.llaveRoboSoccer ?? null) as NonNullable<Torneo['llaveRoboSoccer']> | null,
  };
}

private async persistirLlaveRoboSoccer(
  registro: Awaited<ReturnType<TorneosService['leerLlaveRoboSoccer']>>['registro'],
  llave: NonNullable<Torneo['llaveRoboSoccer']>,
): Promise<void> {
  const guardado = await this.torneoModel.collection.updateOne(
    {
      _id: registro._id,
      categoria: registro.categoria,
      equiposInscritos: { $eq: registro.equiposInscritos ?? [] },
      llaveRoboSoccer: { $eq: registro.llaveRoboSoccer ?? null },
    },
    { $set: { llaveRoboSoccer: llave, updatedAt: new Date() } },
  );

  if (guardado.matchedCount === 0) {
    throw new ConflictException('La llave o la inscripción cambió. Vuelve a cargar la llave.');
  }

  this.invalidatePublicData(registro._id.toString());
}
}
