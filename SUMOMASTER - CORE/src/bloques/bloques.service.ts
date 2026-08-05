import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TorneosService } from '../torneos/torneos.service';
import { GenerarBloquesDto } from './dto/generar-bloques.dto';
import { Bloque, BloqueDocument } from './schemas/bloque.schema';

const POPULATE = {
  path: 'robots',
  select: 'nombre equipo',
  populate: { path: 'equipo', select: 'nombre' },
};

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

@Injectable()
export class BloquesService {
  constructor(
    @InjectModel(Bloque.name) private readonly bloqueModel: Model<BloqueDocument>,
    private readonly torneosService: TorneosService,
  ) {}

  async findByTorneo(torneoId: string): Promise<BloqueDocument[]> {
    return this.bloqueModel
      .find({ torneo: torneoId })
      .populate(POPULATE)
      .sort({ nombre: 1 })
      .exec();
  }

  async generar(torneoId: string, dto: GenerarBloquesDto): Promise<BloqueDocument[]> {
    const torneo = await this.torneosService.findOne(torneoId);
    const tamanioBloque = dto.tamanioBloque ?? torneo.tamanioBloque ?? 16;

    const robots = [...torneo.robotsInscritos] as Types.ObjectId[];

    if (robots.length === 0) {
      throw new BadRequestException(
        'El torneo no tiene robots inscritos. Inscribe robots antes de generar los bloques.',
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

    const documentos = await this.bloqueModel.insertMany(
      grupos.map((robotsBloque, index) => ({
        torneo: new Types.ObjectId(torneoId),
        nombre: `Bloque ${LETRAS[index] ?? index + 1}`,
        robots: robotsBloque,
      })),
    );

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
