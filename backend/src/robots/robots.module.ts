import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { RobotsService } from './robots.service';
import { RobotsController } from './robots.controller';
import { Robot, RobotSchema } from './schemas/robot.schema';
import {
  Equipo,
  EquipoSchema,
} from '../equipos/schemas/equipo.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Robot.name,
        schema: RobotSchema,
      },
      {
        name: Equipo.name,
        schema: EquipoSchema,
      },
    ]),
  ],
  controllers: [RobotsController],
  providers: [RobotsService],
})
export class RobotsModule {}