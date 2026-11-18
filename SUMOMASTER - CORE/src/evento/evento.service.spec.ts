import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Model, Types } from 'mongoose';
import { Torneo } from '../torneos/schemas/torneo.schema';
import { UpdateEventoConfigDto } from './dto/update-evento-config.dto';
import { EventoService } from './evento.service';
import { EventoConfig } from './schemas/evento-config.schema';

describe('EventoService lema', () => {
  it('valida, persiste y devuelve el lema guardado', async () => {
    const dto = plainToInstance(UpdateEventoConfigDto, {
      lema: '  Competencia y tecnología  ',
    });
    const validationErrors = await validate(dto, { whitelist: true });

    expect(validationErrors).toHaveLength(0);
    expect(dto.lema).toBe('Competencia y tecnología');

    const persistedConfig = {
      clave: 'principal',
      nombreEvento: 'BATTLEBOT UTEQ 2026',
      lema: '',
    };
    const eventoConfigModel = {
      findOne: jest.fn(() => ({
        lean: () => ({
          exec: async () => ({ ...persistedConfig }),
        }),
      })),
      findOneAndUpdate: jest.fn((_filter, update) => ({
        exec: async () => {
          Object.assign(persistedConfig, update.$set);
          return persistedConfig;
        },
      })),
    } as unknown as Model<EventoConfig>;
    const torneoModel = {} as Model<Torneo>;
    const service = new EventoService(eventoConfigModel, torneoModel);

    const response = await service.actualizarConfiguracion(dto);

    expect(eventoConfigModel.findOneAndUpdate).toHaveBeenCalledWith(
      { clave: 'principal' },
      {
        $set: { lema: 'Competencia y tecnología' },
        $setOnInsert: { clave: 'principal' },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    expect(response.lema).toBe('Competencia y tecnología');
  });
});

describe('EventoService migración de visibilidad', () => {
  it('migra el torneo único anterior y elimina el campo legado', async () => {
    const legacyId = new Types.ObjectId();
    const updateTorneo = jest.fn().mockReturnValue({
      exec: async () => ({ matchedCount: 1 }),
    });
    const eventoConfigModel = {
      collection: {
        findOne: jest.fn().mockResolvedValue({ torneoEnVivoId: legacyId }),
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      },
    } as unknown as Model<EventoConfig>;
    const torneoModel = {
      updateOne: updateTorneo,
    } as unknown as Model<Torneo>;
    const service = new EventoService(eventoConfigModel, torneoModel);

    await service.onModuleInit();

    expect(updateTorneo).toHaveBeenCalledWith(
      { _id: legacyId },
      { $set: { visibleEnLive: true } },
    );
    expect(eventoConfigModel.collection.updateOne).toHaveBeenCalledWith(
      { clave: 'principal', torneoEnVivoId: legacyId },
      { $unset: { torneoEnVivoId: '' } },
    );
  });
});
