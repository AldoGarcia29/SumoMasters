import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EquiposModule } from '../equipos/equipos.module';
import { Torneo, TorneoSchema } from '../torneos/schemas/torneo.schema';
import { Robot, RobotSchema } from './schemas/robot.schema';
import { RobotsController } from './robots.controller';
import { RobotsService } from './robots.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Robot.name, schema: RobotSchema },
      { name: Torneo.name, schema: TorneoSchema },
    ]),
    EquiposModule,
  ],
  controllers: [RobotsController],
  providers: [RobotsService],
  exports: [RobotsService],
})
export class RobotsModule {}
