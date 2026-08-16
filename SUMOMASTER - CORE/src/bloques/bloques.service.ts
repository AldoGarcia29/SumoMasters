import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { MongoServerError } from 'mongodb';
import { Model, Types } from 'mongoose';
import { TorneosService } from '../torneos/torneos.service';
import { GenerarBloquesDto } from './dto/generar-bloques.dto';
import { Bloque, BloqueDocument } from './schemas/bloque.schema';

const POPULATE = {
  path: 'robots',
  select: 'nombre imagenUrl equipo',
  populate: { path: 'equipo', select: 'nombre' },
};

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

@Injectable()
export class BloquesService {
  /**
   * Evita que dos peticiones "generar" para el MISMO torneo se ejecuten en
   * paralelo (p. ej. doble clic, o dos pestañas). Sin este candado, ambas
   * peticiones podían pisarse (deleteMany + insertMany intercalados) y
   * chocar contra el índice único {torneo, nombre}, lo que antes terminaba
   * en un 500 sin explicación.
   */
  private readonly generandoPorTorneo = new Set<string>();

  constructor(
    @InjectModel(Bloque.name) private readonly bloqueModel: Model<BloqueDocument>,
    private readonly torneosService: TorneosService,
  ) {}

  async findByTorneo(torneoId: string): Promise<BloqueDocument[]> {
    try {
      return await this.bloqueModel
        .find({ torneo: torneoId })
        .populate(POPULATE)
        .sort({ nombre: 1 })
        .exec();
    } catch (error: unknown) {
      // Blindaje: si el populate anidado (robots -> equipo) falla por
      // cualquier motivo (p. ej. una referencia inconsistente), preferimos
      // devolver los bloques sin poblar en vez de un error que deja al
      // usuario sin poder avanzar. Se registra en consola para diagnóstico.
      console.error(
        `[Bloques] findByTorneo(${torneoId}) falló con populate, reintentando sin populate:`,
        error,
      );
      return this.bloqueModel.find({ torneo: torneoId }).sort({ nombre: 1 }).exec();
    }
  }

  async generar(torneoId: string, dto: GenerarBloquesDto): Promise<BloqueDocument[]> {
    if (this.generandoPorTorneo.has(torneoId)) {
      throw new ConflictException(
        'Ya se está generando los bloques de este torneo. Espera a que termine antes de volver a intentarlo.',
      );
    }

    this.generandoPorTorneo.add(torneoId);

    try {
      return await this.generarInterno(torneoId, dto);
    } finally {
      this.generandoPorTorneo.delete(torneoId);
    }
  }

  private async generarInterno(
    torneoId: string,
    dto: GenerarBloquesDto,
  ): Promise<BloqueDocument[]> {
    const torneo = await this.torneosService.findOne(torneoId);
    const tamanioBloque = dto.tamanioBloque ?? torneo.tamanioBloque ?? 16;

    if (!torneo.robotsInscritos || torneo.robotsInscritos.length === 0) {
      throw new BadRequestException(
        'El torneo no tiene robots inscritos. Inscribe robots antes de generar los bloques.',
      );
    }

    // torneo.robotsInscritos puede venir "poblado" (documentos completos de Robot)
    // porque TorneosService.findOne() hace populate. Si algún robot inscrito fue
    // eliminado después de inscribirse, Mongoose deja esa posición como `null`
    // — hay que filtrarla, o intentar convertir `null` a ObjectId revienta el server.
    const robots: Types.ObjectId[] = torneo.robotsInscritos
      .filter((r: unknown) => r !== null && r !== undefined)
      .map((r: unknown) => {
        const id = (r as { _id?: unknown })?._id ?? r;
        return id instanceof Types.ObjectId ? id : new Types.ObjectId(String(id));
      });

    const robotsEliminados = torneo.robotsInscritos.length - robots.length;

    if (robots.length === 0) {
      throw new BadRequestException(
        'Ninguno de los robots inscritos en este torneo existe actualmente (fueron eliminados). Vuelve a inscribir robots antes de generar los bloques.',
      );
    }

    if (robotsEliminados > 0) {
      console.warn(
        `[Bloques] Torneo ${torneoId}: se ignoraron ${robotsEliminados} robot(s) inscrito(s) que ya no existen.`,
      );
    }

    // Mezcla aleatoria (Fisher-Yates) — "aleatorio balanceado" reparte lo más
    // parejo posible entre bloques, evitando que uno quede con muchos menos.
    const mezclados = this.shuffle(robots);
    const totalBloques = Math.ceil(mezclados.length / tamanioBloque);

    const grupos: Types.ObjectId[][] = Array.from({ length: totalBloques }, () => []);
    mezclados.forEach((robotId, index) => {
      grupos[index % totalBloques].push(robotId);
    });

    // Regenerar: elimina los bloques previos de este torneo antes de crear los nuevos.
    await this.bloqueModel.deleteMany({ torneo: torneoId }).exec();

    let documentos: BloqueDocument[];

    try {
      documentos = await this.bloqueModel.insertMany(
        grupos.map((robotsBloque, index) => ({
          torneo: new Types.ObjectId(torneoId),
          nombre: `Bloque ${LETRAS[index] ?? index + 1}`,
          robots: robotsBloque,
        })),
      );
    } catch (error: unknown) {
      if (error instanceof MongoServerError && error.code === 11000) {
        // Otra petición concurrente ya generó los bloques de este torneo
        // justo antes que nosotros: devolvemos los que quedaron, en vez de
        // fallar con un 500 por el choque del índice único.
        return this.bloqueModel
          .find({ torneo: torneoId })
          .populate(POPULATE)
          .sort({ nombre: 1 })
          .exec();
      }
      throw error;
    }

    if (!documentos || documentos.length === 0) {
      throw new BadRequestException(
        'No se pudieron crear los bloques. Intenta nuevamente.',
      );
    }

    if (dto.tamanioBloque && dto.tamanioBloque !== torneo.tamanioBloque) {
      await this.torneosService.update(torneoId, { tamanioBloque: dto.tamanioBloque });
    }

    const ids = documentos.map((d) => d._id);
    return this.bloqueModel.find({ _id: { $in: ids } }).populate(POPULATE).sort({ nombre: 1 }).exec();
  }

  private shuffle<T>(items: T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
