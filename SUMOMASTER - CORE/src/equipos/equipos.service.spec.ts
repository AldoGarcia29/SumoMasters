import { Model } from 'mongoose';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateEquipoDto } from './dto/create-equipo.dto';
import { Equipo, EquipoDocument } from './schemas/equipo.schema';
import { EquiposService } from './equipos.service';

describe('EquiposService image upload fallback', () => {
  it('creates a team without persisting a base64 logo when Cloudinary is unconfigured', async () => {
    const logoUrl = 'data:image/png;base64,abc';
    const createEquipo = jest.fn((payload: Record<string, unknown>) => ({
      save: jest.fn().mockResolvedValue(undefined),
      populate: jest.fn().mockResolvedValue(payload),
    }));
    const cloudinaryService = {
      uploadBase64: jest.fn().mockResolvedValue(null),
    };
    const service = new EquiposService(
      createEquipo as unknown as Model<EquipoDocument>,
      cloudinaryService as unknown as CloudinaryService,
    );
    const dto: CreateEquipoDto = {
      nombre: 'Equipo local',
      institucion: 'UTEQ',
      categoria: '507f1f77bcf86cd799439011',
      integrantes: [{ nombre: 'Participante' }],
      logoUrl,
    };

    const result = await service.create(dto);

    expect(createEquipo).toHaveBeenCalledWith(
      expect.objectContaining({ logoUrl: '' }),
    );
    expect(result).toEqual(expect.objectContaining({ logoUrl: '' }));
    expect(cloudinaryService.uploadBase64).toHaveBeenCalledWith(
      logoUrl,
      'sumomaster_teams',
    );
  });
});
