import {
  Injectable,
  NotFoundException,
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
  torneoEnVivoId: null,
};

@Injectable()
export class EventoService {
  constructor(
    @InjectModel(EventoConfig.name)
    private readonly eventoConfigModel: Model<EventoConfig>,
    @InjectModel(Torneo.name)
    private readonly torneoModel: Model<Torneo>,
  ) {}

  async obtenerConfiguracion() {
    const config = await this.eventoConfigModel
      .findOne({ clave: EVENTO_CONFIG_KEY })
      .lean()
      .exec();

    return {
      nombreEvento: config?.nombreEvento ?? DEFAULT_EVENTO_CONFIG.nombreEvento,
      lema: config?.lema ?? DEFAULT_EVENTO_CONFIG.lema,
      torneoEnVivoId: config?.torneoEnVivoId
        ? String(config.torneoEnVivoId)
        : DEFAULT_EVENTO_CONFIG.torneoEnVivoId,
    };
  }

  async actualizarConfiguracion(dto: UpdateEventoConfigDto) {
    if (dto.torneoEnVivoId) {
      const torneoPublico = await this.torneoModel.exists({
        _id: dto.torneoEnVivoId,
        publico: true,
      });
      if (!torneoPublico) {
        throw new NotFoundException('El torneo público seleccionado no existe');
      }
    }

    const cambios: Record<string, string | Types.ObjectId | null> = {};
    if (dto.nombreEvento !== undefined) cambios.nombreEvento = dto.nombreEvento;
    if (dto.lema !== undefined) cambios.lema = dto.lema;
    if (dto.torneoEnVivoId !== undefined) {
      cambios.torneoEnVivoId = dto.torneoEnVivoId
        ? new Types.ObjectId(dto.torneoEnVivoId)
        : null;
    }

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
