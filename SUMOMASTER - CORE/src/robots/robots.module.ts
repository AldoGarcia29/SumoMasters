import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EquiposModule } from '../equipos/equipos.module';
import { Robot, RobotSchema } from './schemas/robot.schema';
import { RobotsController } from './robots.controller';
import { RobotsService } from './robots.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Robot.name, schema: RobotSchema }]),
    EquiposModule,
  ],
  controllers: [RobotsController],
  providers: [RobotsService],
  exports: [RobotsService],
})
export class RobotsModule {}
