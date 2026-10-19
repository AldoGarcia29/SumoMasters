import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';


import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  Bloque,
  BloqueDocument,
} from '../bloques/schemas/bloque.schema';

import {
  Dojo,
  DojoDocument,
} from '../dojos/schemas/dojo.schema';

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

import {
  Combate,
  CombateDocument,
} from './schemas/combate.schema';





const POPULATE = [
  { path: 'robot1', select: 'nombre imagenUrl equipo', populate: { path: 'equipo', select: 'nombre' } },
  { path: 'robot2', select: 'nombre imagenUrl equipo', populate: { path: 'equipo', select: 'nombre' } },
  { path: 'dojo', select: 'nombre estado' },
  { path: 'bloque', select: 'nombre' },
];

@Injectable()
export class CombatesService {
  /** Mismo propósito que en BloquesService: evitar generaciones duplicadas por doble clic o pestañas paralelas. */
  private readonly generandoPorTorneo = new Set<string>();

  constructor(
    @InjectModel(Combate.name) private readonly combateModel: Model<CombateDocument>,
    @InjectModel(Bloque.name) private readonly bloqueModel: Model<BloqueDocument>,
    @InjectModel(Dojo.name) private readonly dojoModel: Model<DojoDocument>,
  ) {}

  async findByTorneo(
  torneoId: string,
  filters?: {
    bloque?: string;
    dojo?: string;
    estado?: string;
    fase?: string;
  },
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

  const totalSinPopulate =
    await this.combateModel.countDocuments(query).exec();

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

  console.log(
    `[Combates] Devueltos después de populate: ${combates.length}`,
  );

  return combates;
}

  async findOne(id: string): Promise<CombateDocument> {
    const combate = await this.combateModel.findById(id).populate(POPULATE).exec();
    if (!combate) throw new NotFoundException('Combate no encontrado');
    return combate;
  }

  /** Genera los enfrentamientos round-robin (todos contra todos) de uno o todos los bloques del torneo. */
  async generar(torneoId: string, dto: GenerarCombatesDto): Promise<CombateDocument[]> {
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
    const fase = dto.fase ?? FaseCombate.FASE_GRUPOS;

    let bloques;
    if (dto.bloqueIds && dto.bloqueIds.length > 0) {
      // Vía preferida: el frontend ya tiene los bloques cargados (p. ej.
      // recién generados) y nos manda sus IDs directamente, sin depender de
      // una nueva búsqueda por torneoId.
      bloques = await this.bloqueModel.find({ _id: { $in: dto.bloqueIds } }).exec();
    } else if (dto.bloqueId) {
      bloques = await this.bloqueModel.find({ _id: dto.bloqueId, torneo: torneoId }).exec();
    } else {
      bloques = await this.bloqueModel.find({ torneo: torneoId }).exec();
    }

    if (bloques.length === 0) {
      throw new BadRequestException(
        'No hay bloques generados para este torneo. Genera los bloques primero.',
      );
    }

    // Al regenerar una fase se eliminan todos los combates anteriores
// de esa fase y torneo, incluso si los bloques fueron regenerados.
await this.combateModel
  .deleteMany({
    torneo: new Types.ObjectId(torneoId),
    fase,
  })
  .exec();

    const documentos: Record<string, unknown>[] = [];

    for (const bloque of bloques) {
      const robots = bloque.robots as Types.ObjectId[];
      let numero = 1;

      for (let i = 0; i < robots.length; i++) {
        for (let j = i + 1; j < robots.length; j++) {
          documentos.push({
            torneo: new Types.ObjectId(torneoId),
            bloque: bloque._id,
            fase,
            numero: numero++,
            robot1: robots[i],
            robot2: robots[j],
            estado: EstadoCombate.PENDIENTE,
          });
        }
      }
    }

    if (documentos.length === 0) {
      throw new BadRequestException(
        'Los bloques no tienen suficientes robots para generar enfrentamientos.',
      );
    }

    const creados = await this.combateModel.insertMany(documentos);
    const ids: Types.ObjectId[] = creados.map((c) => c._id as Types.ObjectId);
    return this.combateModel.find({ _id: { $in: ids } }).populate(POPULATE).sort({ bloque: 1, numero: 1 }).exec();
  }

  /** Resumen de ocupación de cada dojo dentro de un torneo (para la pantalla de asignación). */
  async resumenDojos(torneoId: string): Promise<
    { dojo: DojoDocument; combatesAsignados: number }[]
  > {
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
    .find({
      torneo: torneoId,
      fase,
    })
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
  if (
    !Types.ObjectId.isValid(torneoId)
  ) {
    throw new BadRequestException(
      'El identificador del torneo no es válido.',
    );
  }

  const filtro: Record<
    string,
    unknown
  > = {
    torneo: new Types.ObjectId(
      torneoId,
    ),

    estado: {
      $in: [
        EstadoCombate.PENDIENTE,
        EstadoCombate.EN_CURSO,
      ],
    },
  };

  if (fase) {
    filtro.fase = fase;
  }

  const combates =
    await this.combateModel
      .find(filtro)
      .exec();

  if (combates.length === 0) {
    return {
      actualizados: 0,
    };
  }

  const ahora = new Date();

  const operaciones =
    combates.map((combate) => {
      const resultado =
        Math.random() < 0.5
          ? ResultadoCombate.GANA_ROBOT_1
          : ResultadoCombate.GANA_ROBOT_2;

      const duracionSegundos =
        Math.floor(
          Math.random() * 151,
        ) + 30;

      return {
        updateOne: {
          filter: {
            _id: combate._id,
          },

          update: {
            $set: {
              estado:
                EstadoCombate.FINALIZADO,

              resultado,

              metodoVictoria:
                MetodoVictoria.PUNTOS,

              duracionSegundos,

              observaciones:
                'Resultado generado automáticamente para pruebas.',

            },
          },
        },
      };
    });

  const resultadoActualizacion =
    await this.combateModel.bulkWrite(
      operaciones,
    );

  return {
    actualizados:
      resultadoActualizacion.modifiedCount,
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
): Promise<CombateDocument[]>  {
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

  const torneoObjectId =
    new Types.ObjectId(torneoId);

  // Permite regenerar la ronda antes de comenzar,
  // evitando enfrentamientos duplicados.
  const octavosExistentes =
    await this.combateModel.find({
      torneo: torneoObjectId,
      fase: FaseCombate.OCTAVOS,
    });

  const yaIniciados = octavosExistentes.some(
    (combate) =>
      combate.estado !== EstadoCombate.PENDIENTE,
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
      fase: FaseCombate.OCTAVOS,
      numero: cruce.numero,
      robot1: new Types.ObjectId(
        cruce.robot1Id,
      ),
      robot2: new Types.ObjectId(
        cruce.robot2Id,
      ),
      dojo: null,
      turno: null,
      arena: null,
      estado: EstadoCombate.PENDIENTE,
      resultado: null,
      metodoVictoria: null,
      duracionSegundos: null,
      jueces: [],
      observaciones:
        'Ronda preliminar de la fase eliminatoria.',
      historial: [
        {
          hora: new Date(),
          descripcion:
            'Combate preliminar generado automáticamente.',
          tipo: 'info',
        },
      ],
    })),
  );

  return this.combateModel
    .find({
      torneo: torneoObjectId,
      fase: FaseCombate.OCTAVOS,
    })
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

    return this.combateModel.findById(id).populate(POPULATE).exec() as Promise<CombateDocument>;
  }

  async quitarDojo(id: string): Promise<CombateDocument> {
    const combate = await this.combateModel
      .findByIdAndUpdate(id, {
  $set: {
    dojo: null,
    turno: null,
    arena: null,
  },
}, { new: true })
      .populate(POPULATE)
      .exec();

    if (!combate) throw new NotFoundException('Combate no encontrado');
    return combate;
  }

  /** Reparte automáticamente los combates pendientes sin dojo entre los dojos disponibles, respetando su capacidad. */
  async asignarDojosAutomatico(
  torneoId: string,
  fase?: string,
): Promise<CombateDocument[]> {
  if (!Types.ObjectId.isValid(torneoId)) {
    throw new BadRequestException('El ID del torneo no es válido.');
  }

  const torneoObjectId = new Types.ObjectId(torneoId);

  const query: Record<string, unknown> = {
    torneo: torneoObjectId,
    estado: EstadoCombate.PENDIENTE,
  };

  if (fase) {
    query.fase = fase;
  }

  const combates = await this.combateModel
    .find(query)
    .sort({ bloque: 1, numero: 1 })
    .exec();

  if (combates.length === 0) {
    throw new BadRequestException(
      'No hay combates pendientes para asignar en este torneo.',
    );
  }

  const dojos = await this.dojoModel
    .find({
      estado: { $ne: EstadoDojo.MANTENIMIENTO },
    })
    .sort({ nombre: 1 })
    .exec();

  if (dojos.length === 0) {
    throw new BadRequestException(
      'No hay dojos disponibles para asignar.',
    );
  }

  // Limpiamos solamente las asignaciones pendientes del torneo y fase actual.
  await this.combateModel
    .updateMany(query, {
      $set: {
        dojo: null,
        turno: null,
        arena: null,
      },
    })
    .exec();

  const restantes = [...combates];
  const operaciones: Parameters<
    typeof this.combateModel.bulkWrite
  >[0] = [];

  let turno = 1;

  while (restantes.length > 0) {
    const robotsOcupados = new Set<string>();
    let asignadosEnTurno = 0;

    for (const dojo of dojos) {
      for (let arena = 1; arena <= dojo.capacidad; arena++) {
        const indiceCombate = restantes.findIndex((combate) => {
          const robot1Id = combate.robot1.toString();
          const robot2Id = combate.robot2.toString();

          return (
            !robotsOcupados.has(robot1Id) &&
            !robotsOcupados.has(robot2Id)
          );
        });

        if (indiceCombate === -1) {
          continue;
        }

        const [combate] = restantes.splice(indiceCombate, 1);

        robotsOcupados.add(combate.robot1.toString());
        robotsOcupados.add(combate.robot2.toString());

        operaciones.push({
          updateOne: {
            filter: {
              _id: combate._id,
              torneo: torneoObjectId,
            },
            update: {
              $set: {
                dojo: dojo._id,
                turno,
                arena,
              },
            },
          },
        });

        asignadosEnTurno++;
      }
    }

    if (asignadosEnTurno === 0) {
      throw new BadRequestException(
        'No fue posible organizar los combates restantes.',
      );
    }

    turno++;
  }

  await this.combateModel.bulkWrite(operaciones, {
    ordered: true,
  });

  const filtroAsignados = {
  torneo: torneoObjectId,
  dojo: { $ne: null },
  ...(fase
    ? { fase: fase as FaseCombate }
    : {}),
};

return this.combateModel
  .find(filtroAsignados)
  .populate(POPULATE)
  .sort({
    turno: 1,
    dojo: 1,
    arena: 1,
  })
  .exec();
}

  async iniciar(id: string): Promise<CombateDocument> {
    const combate = await this.combateModel.findById(id).exec();
    if (!combate) throw new NotFoundException('Combate no encontrado');

    if (combate.estado === EstadoCombate.FINALIZADO) {
      throw new BadRequestException('Este combate ya fue finalizado');
    }

    combate.estado = EstadoCombate.EN_CURSO;
    combate.historial.push({
      hora: new Date(),
      descripcion: 'Combate iniciado',
      tipo: 'info',
    });
    await combate.save();

    return this.combateModel.findById(id).populate(POPULATE).exec() as Promise<CombateDocument>;
  }

  async registrarResultado(id: string, dto: RegistrarResultadoDto): Promise<CombateDocument> {
    const combate = await this.combateModel.findById(id).exec();
    if (!combate) throw new NotFoundException('Combate no encontrado');

    if (combate.estado === EstadoCombate.FINALIZADO) {
      throw new BadRequestException(
        'Este combate ya fue registrado y no puede modificarse.',
      );
    }

    combate.resultado = dto.resultado;
    combate.metodoVictoria = dto.metodoVictoria ?? null;
    combate.duracionSegundos = dto.duracionSegundos ?? null;
    combate.jueces = dto.jueces ?? [];
    combate.observaciones = dto.observaciones ?? '';
    combate.estado = EstadoCombate.FINALIZADO;
    combate.historial.push({
      hora: new Date(),
      descripcion: `Combate finalizado — ${dto.resultado}`,
      tipo: 'success',
    });

    await combate.save();

    return this.combateModel.findById(id).populate(POPULATE).exec() as Promise<CombateDocument>;
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

    return this.combateModel.findById(id).populate(POPULATE).exec() as Promise<CombateDocument>;
  }

  /** Conteo global (todos los torneos) para las tarjetas del dashboard. */
  async statsGlobal(): Promise<{ total: number; finalizados: number }> {
    const [total, finalizados] = await Promise.all([
      this.combateModel.countDocuments().exec(),
      this.combateModel.countDocuments({ estado: EstadoCombate.FINALIZADO }).exec(),
    ]);

    return { total, finalizados };
  }
}
