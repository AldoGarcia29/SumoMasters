import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Model } from 'mongoose';
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
      torneoEnVivoId: null,
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
