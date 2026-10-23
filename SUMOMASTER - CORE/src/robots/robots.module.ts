import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EquiposModule } from '../equipos/equipos.module';
import { Torneo, TorneoSchema } from '../torneos/schemas/torneo.schema';
import { Robot, RobotSchema } from './schemas/robot.schema';
import { RobotsController } from './robots.controller';
import { RobotsService } from './robots.service';
import { Equipo, EquipoSchema } from '../equipos/schemas/equipo.schema';
import { CloudinaryModule } from '../cloudinary/cloudinary.module'; // Ajusta la ruta según donde lo creaste
import {
  Categoria,
  CategoriaSchema,
} from '../categorias/schemas/categoria.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Robot.name, schema: RobotSchema },
      { name: Torneo.name, schema: TorneoSchema },
      { name: Equipo.name, schema: EquipoSchema },
      { name: Categoria.name, schema: CategoriaSchema },
    ]),
    EquiposModule,
    CloudinaryModule,
  ],
  controllers: [RobotsController],
  providers: [RobotsService],
  exports: [RobotsService],
})
export class RobotsModule {}
