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
  select: 'nombre imagenUrl equipo',
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
    const torneo =
      await this.torneosService.findOne(torneoId);

    const tamanioBloque =
      dto.tamanioBloque ??
      torneo.tamanioBloque ??
      16;

    if (
      !Number.isInteger(tamanioBloque) ||
      tamanioBloque < 2
    ) {
      throw new BadRequestException(
        'El tamaño del bloque debe ser un número entero mayor o igual a 2.',
      );
    }

    if (
      !torneo.robotsInscritos ||
      torneo.robotsInscritos.length === 0
    ) {
      throw new BadRequestException(
        'El torneo no tiene robots inscritos. Inscribe robots antes de generar los bloques.',
      );
    }

    /*
     * robotsInscritos puede contener documentos completos
     * porque TorneosService realiza populate.
     *
     * Si algún robot fue eliminado, Mongoose puede dejar
     * la posición como null. Por eso se filtran primero.
     */
    const robots: Types.ObjectId[] =
      torneo.robotsInscritos
        .filter(
          (robot: unknown) =>
            robot !== null &&
            robot !== undefined,
        )
        .map((robot: unknown) => {
          const id =
            (robot as { _id?: unknown })?._id ??
            robot;

          return id instanceof Types.ObjectId
            ? id
            : new Types.ObjectId(String(id));
        });

    const robotsEliminados =
      torneo.robotsInscritos.length -
      robots.length;

    if (robots.length === 0) {
      throw new BadRequestException(
        'Ninguno de los robots inscritos existe actualmente. Vuelve a inscribir robots antes de generar los bloques.',
      );
    }

    if (robotsEliminados > 0) {
      console.warn(
        `[Bloques] Torneo ${torneoId}: se ignoraron ${robotsEliminados} robot(s) que ya no existen.`,
      );
    }

    const mezclados = this.shuffle(robots);

    const metodoDistribucion =
      dto.metodoDistribucion ?? 'aleatorio';

    const totalBloques = Math.ceil(
      mezclados.length / tamanioBloque,
    );

    let grupos: Types.ObjectId[][];

    if (
      metodoDistribucion ===
      'aleatorio-balanceado'
    ) {
      /*
       * Distribución uniforme:
       * 46 robots → 16, 15 y 15.
       */
      grupos = Array.from(
        { length: totalBloques },
        () => [],
      );

      mezclados.forEach(
        (robotId, index) => {
          grupos[index % totalBloques].push(
            robotId,
          );
        },
      );
    } else {
      /*
       * Distribución por capacidad máxima:
       * 46 robots → 16, 16 y 14.
       */
      grupos = [];

      for (
        let inicio = 0;
        inicio < mezclados.length;
        inicio += tamanioBloque
      ) {
        grupos.push(
          mezclados.slice(
            inicio,
            inicio + tamanioBloque,
          ),
        );
      }
    }

    const nombresGenerados = grupos.map(
      (_, index) =>
        `Bloque ${
          LETRAS[index] ?? index + 1
        }`,
    );

    /*
     * Crea los bloques si no existen o actualiza sus
     * robots si ya estaban registrados.
     */
    await this.bloqueModel.bulkWrite(
      grupos.map(
        (robotsBloque, index) => {
          const nombre =
            `Bloque ${
              LETRAS[index] ?? index + 1
            }`;

          return {
            updateOne: {
              filter: {
                torneo:
                  new Types.ObjectId(
                    torneoId,
                  ),
                nombre,
              },
              update: {
                $set: {
                  robots: robotsBloque,
                },
                $setOnInsert: {
                  torneo:
                    new Types.ObjectId(
                      torneoId,
                    ),
                  nombre,
                },
              },
              upsert: true,
            },
          };
        },
      ),
      {
        ordered: true,
      },
    );

    /*
     * Si antes existían más bloques y la nueva
     * distribución necesita menos, elimina solamente
     * los bloques sobrantes.
     */
    await this.bloqueModel
      .deleteMany({
        torneo:
          new Types.ObjectId(torneoId),
        nombre: {
          $nin: nombresGenerados,
        },
      })
      .exec();

    /*
     * Actualiza el tamaño configurado del torneo
     * si el administrador seleccionó uno diferente.
     */
    if (
      dto.tamanioBloque &&
      dto.tamanioBloque !==
        torneo.tamanioBloque
    ) {
      await this.torneosService.update(
        torneoId,
        {
          tamanioBloque:
            dto.tamanioBloque,
        },
      );
    }

    const bloquesGenerados =
      await this.bloqueModel
        .find({
          torneo:
            new Types.ObjectId(torneoId),
          nombre: {
            $in: nombresGenerados,
          },
        })
        .populate(POPULATE)
        .sort({ nombre: 1 })
        .exec();

    if (
      bloquesGenerados.length !==
      grupos.length
    ) {
      throw new BadRequestException(
        'No se pudieron crear todos los bloques. Intenta nuevamente.',
      );
    }

    return bloquesGenerados;
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