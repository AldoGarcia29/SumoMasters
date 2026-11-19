import { Model } from 'mongoose';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { Equipo, EquipoDocument } from '../equipos/schemas/equipo.schema';
import { EquiposService } from '../equipos/equipos.service';
import { Categoria } from '../categorias/schemas/categoria.schema';
import { Torneo, TorneoDocument } from '../torneos/schemas/torneo.schema';
import { CreateRobotDto } from './dto/create-robot.dto';
import { EstadoRobot } from './enums/estado-robot.enum';
import { Robot, RobotDocument } from './schemas/robot.schema';
import { RobotsService } from './robots.service';

describe('RobotsService image upload fallback', () => {
  it('creates a robot without persisting a base64 image when Cloudinary is unconfigured', async () => {
    const imageUrl = 'data:image/png;base64,abc';
    const robot = {
      nombre: 'Robot local',
      equipo: '507f1f77bcf86cd799439011',
      categoria: '507f1f77bcf86cd799439012',
      pesoKg: 2,
      estado: EstadoRobot.ACTIVO,
      imagenUrl: '',
    };
    const createRobot = jest.fn((payload: typeof robot) => ({
      save: jest.fn().mockResolvedValue(undefined),
      toObject: jest.fn().mockReturnValue(payload),
    }));
    const lookup = (value: object) => ({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(value),
    });
    const equipoModel = {
      findById: jest.fn().mockReturnValue(lookup({ nombre: 'Equipo local' })),
    };
    const categoriaModel = {
      findById: jest.fn().mockReturnValue(lookup({ nombre: 'Mini Sumo' })),
    };
    const equiposService = {
      incrementRobotsCount: jest.fn().mockResolvedValue(undefined),
    };
    const cloudinaryService = {
      uploadBase64: jest.fn().mockResolvedValue(null),
    };
    const service = new RobotsService(
      createRobot as unknown as Model<RobotDocument>,
      {} as Model<TorneoDocument>,
      equipoModel as unknown as Model<EquipoDocument>,
      categoriaModel as unknown as Model<Categoria>,
      equiposService as unknown as EquiposService,
      cloudinaryService as unknown as CloudinaryService,
    );
    const dto: CreateRobotDto = {
      nombre: robot.nombre,
      equipo: robot.equipo,
      categoria: robot.categoria,
      pesoKg: robot.pesoKg,
      estado: robot.estado,
      imagenUrl: imageUrl,
    };

    const result = await service.create(dto);

    expect(createRobot).toHaveBeenCalledWith(
      expect.objectContaining({ imagenUrl: '' }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        nombre: 'Robot local',
        imagenUrl: '',
        equipo: { nombre: 'Equipo local' },
        categoria: { nombre: 'Mini Sumo' },
      }),
    );
    expect(cloudinaryService.uploadBase64).toHaveBeenCalledWith(imageUrl);
  });
});
