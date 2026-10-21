import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TorneosService } from '../torneos/torneos.service';
import { GenerarBloquesDto } from './dto/generar-bloques.dto';
import {
  Bloque,
  BloqueDocument,
} from './schemas/bloque.schema';

const POPULATE = {
  path: 'robots',
  select: 'nombre imagenUrl equipo pesoKg createdAt',
  populate: {
    path: 'equipo',
    select: 'nombre',
  },
};

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

@Injectable()
export class BloquesService {
  /**
   * Evita que dos peticiones para generar bloques del mismo
   * torneo se ejecuten simultáneamente.
   */
  private readonly generandoPorTorneo =
    new Set<string>();

  constructor(
    @InjectModel(Bloque.name)
    private readonly bloqueModel:
      Model<BloqueDocument>,

    private readonly torneosService:
      TorneosService,
  ) {}

  async findByTorneo(
    torneoId: string,
  ): Promise<BloqueDocument[]> {
    try {
      return await this.bloqueModel
        .find({
          torneo: new Types.ObjectId(torneoId),
        })
        .populate(POPULATE)
        .sort({ nombre: 1 })
        .exec();
    } catch (error: unknown) {
      console.error(
        `[Bloques] findByTorneo(${torneoId}) falló con populate. Reintentando sin populate:`,
        error,
      );

      return this.bloqueModel
        .find({
          torneo: new Types.ObjectId(torneoId),
        })
        .sort({ nombre: 1 })
        .exec();
    }
  }

  async generar(
    torneoId: string,
    dto: GenerarBloquesDto,
  ): Promise<BloqueDocument[]> {
    if (this.generandoPorTorneo.has(torneoId)) {
      throw new ConflictException(
        'Ya se están generando los bloques de este torneo. Espera a que termine el proceso.',
      );
    }

    this.generandoPorTorneo.add(torneoId);

    try {
      return await this.generarInterno(
        torneoId,
        dto,
      );
    } finally {
      this.generandoPorTorneo.delete(torneoId);
    }
  }

  private async generarInterno(
  torneoId: string,
  dto: GenerarBloquesDto,
): Promise<BloqueDocument[]> {
  const torneo = await this.torneosService.findOne(torneoId);
  const cantidadBloques = dto.cantidadBloques;

  if (
    !Number.isInteger(cantidadBloques) ||
    cantidadBloques < 1
  ) {
    throw new BadRequestException(
      'La cantidad de bloques debe ser un entero mayor o igual a 1.',
    );
  }

  type RobotParaDistribuir = {
    _id: Types.ObjectId;
    nombre?: string;
    pesoKg?: number | null;
    createdAt?: Date | string;
  };

  // findOne() devuelve robots poblados con pesoKg y createdAt.
  const inscritos =
    (torneo.robotsInscritos ?? []) as unknown as
      Array<RobotParaDistribuir | null>;

  const robots = inscritos.filter(
    (robot): robot is RobotParaDistribuir => robot != null,
  );

  if (robots.length === 0) {
    throw new BadRequestException(
      'El torneo no tiene robots válidos inscritos.',
    );
  }

  if (cantidadBloques > robots.length) {
    throw new BadRequestException(
      `No puedes crear ${cantidadBloques} bloques con ${robots.length} robots.`,
    );
  }

  // Evita asignaciones duplicadas si la inscripción contiene IDs repetidos.
  const ids = robots.map((robot) => String(robot._id));

  if (new Set(ids).size !== ids.length) {
    throw new BadRequestException(
      'Hay robots inscritos más de una vez. Corrige las inscripciones antes de generar bloques.',
    );
  }

  // No tratamos un peso ausente como cero.
  const sinPeso = robots.filter(
    (robot) =>
      typeof robot.pesoKg !== 'number' ||
      !Number.isFinite(robot.pesoKg) ||
      robot.pesoKg < 0,
  );

  if (sinPeso.length > 0) {
    throw new BadRequestException(
      `Registra un peso válido para: ${sinPeso
        .map((robot) => robot.nombre ?? String(robot._id))
        .join(', ')}.`,
    );
  }

  const fechaRegistro = (robot: RobotParaDistribuir): number => {
    if (robot.createdAt) {
      const fecha = new Date(robot.createdAt).getTime();

      if (Number.isFinite(fecha)) {
        return fecha;
      }
    }

    // Para documentos antiguos sin createdAt.
    return new Types.ObjectId(String(robot._id))
      .getTimestamp()
      .getTime();
  };

  const ordenados = [...robots].sort((a, b) => {
    // Mayor peso primero.
    const diferenciaPeso = b.pesoKg! - a.pesoKg!;

    if (diferenciaPeso !== 0) {
      return diferenciaPeso;
    }

    // Con el mismo peso, primero el registrado antes.
    const diferenciaFecha =
      fechaRegistro(a) - fechaRegistro(b);

    if (diferenciaFecha !== 0) {
      return diferenciaFecha;
    }

    // Desempate determinista si comparten fecha.
    return String(a._id).localeCompare(String(b._id));
  });

  const grupos: Types.ObjectId[][] = Array.from(
    { length: cantidadBloques },
    () => [],
  );

  ordenados.forEach((robot, posicion) => {
    const pasada = Math.floor(posicion / cantidadBloques);
    const columna = posicion % cantidadBloques;

    const destino =
      pasada % 2 === 0
        ? columna
        : cantidadBloques - 1 - columna;

    grupos[destino].push(
      new Types.ObjectId(String(robot._id)),
    );
  });

  // A...Z, AA, AB... para admitir más de 26 bloques.
  const nombreBloque = (indice: number): string => {
    let numero = indice + 1;
    let letras = '';

    while (numero > 0) {
      numero--;
      letras =
        String.fromCharCode(65 + (numero % 26)) + letras;
      numero = Math.floor(numero / 26);
    }

    return `Bloque ${letras}`;
  };

  const nombresGenerados = grupos.map(
    (_, indice) => nombreBloque(indice),
  );

  const torneoObjectId = new Types.ObjectId(torneoId);

  await this.bloqueModel.bulkWrite(
    grupos.map((robotsBloque, indice) => ({
      updateOne: {
        filter: {
          torneo: torneoObjectId,
          nombre: nombresGenerados[indice],
        },
        update: {
          $set: {
            robots: robotsBloque,
          },
          $setOnInsert: {
            torneo: torneoObjectId,
            nombre: nombresGenerados[indice],
          },
        },
        upsert: true,
      },
    })),
    { ordered: true },
  );

  await this.bloqueModel.deleteMany({
    torneo: torneoObjectId,
    nombre: { $nin: nombresGenerados },
  }).exec();

  const bloquesGenerados = await this.bloqueModel
    .find({
      torneo: torneoObjectId,
      nombre: { $in: nombresGenerados },
    })
    .populate(POPULATE)
    .exec();

  if (bloquesGenerados.length !== grupos.length) {
    throw new BadRequestException(
      'No se pudieron crear todos los bloques.',
    );
  }

  // Mantiene A, B... Z, AA, AB en el orden de generación.
  const posiciones = new Map(
    nombresGenerados.map((nombre, indice) => [nombre, indice]),
  );

  return bloquesGenerados.sort(
    (a, b) =>
      posiciones.get(a.nombre)! - posiciones.get(b.nombre)!,
  );
}

  private shuffle<T>(items: T[]): T[] {
    const arr = [...items];

    for (
      let index = arr.length - 1;
      index > 0;
      index--
    ) {
      const randomIndex = Math.floor(
        Math.random() * (index + 1),
      );

      [
        arr[index],
        arr[randomIndex],
      ] = [
        arr[randomIndex],
        arr[index],
      ];
    }

    return arr;
  }
}