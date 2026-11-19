import {
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Torneo } from '../torneos/schemas/torneo.schema';
import { UpdateEventoConfigDto } from './dto/update-evento-config.dto';
import { EventoConfig } from './schemas/evento-config.schema';

const EVENTO_CONFIG_KEY = 'principal';
const DEFAULT_EVENTO_CONFIG = {
  nombreEvento: 'BATTLEBOT UTEQ 2026',
  lema: '',
};

@Injectable()
export class EventoService implements OnModuleInit {
  constructor(
    @InjectModel(EventoConfig.name)
    private readonly eventoConfigModel: Model<EventoConfig>,
    @InjectModel(Torneo.name)
    private readonly torneoModel: Model<Torneo>,
  ) {}

  async onModuleInit(): Promise<void> {
    const config = await this.eventoConfigModel.collection.findOne(
      { clave: EVENTO_CONFIG_KEY },
      { projection: { torneoEnVivoId: 1 } },
    );
    const legacyId = config?.torneoEnVivoId;
    if (!legacyId) return;

    if (Types.ObjectId.isValid(legacyId)) {
      await this.torneoModel
        .updateOne(
          { _id: new Types.ObjectId(legacyId) },
          { $set: { visibleEnLive: true } },
        )
        .exec();
    }

    await this.eventoConfigModel.collection.updateOne(
      { clave: EVENTO_CONFIG_KEY, torneoEnVivoId: legacyId },
      { $unset: { torneoEnVivoId: '' } },
    );
  }

  async obtenerConfiguracion() {
    const config = await this.eventoConfigModel
      .findOne({ clave: EVENTO_CONFIG_KEY })
      .lean()
      .exec();

    return {
      nombreEvento: config?.nombreEvento ?? DEFAULT_EVENTO_CONFIG.nombreEvento,
      lema: config?.lema ?? DEFAULT_EVENTO_CONFIG.lema,
    };
  }

  async actualizarConfiguracion(dto: UpdateEventoConfigDto) {
    const cambios: Record<string, string | Types.ObjectId | null> = {};
    if (dto.nombreEvento !== undefined) cambios.nombreEvento = dto.nombreEvento;
    if (dto.lema !== undefined) cambios.lema = dto.lema;

    await this.eventoConfigModel
      .findOneAndUpdate(
        { clave: EVENTO_CONFIG_KEY },
        {
          $set: cambios,
          $setOnInsert: { clave: EVENTO_CONFIG_KEY },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();

    return this.obtenerConfiguracion();
  }
}
