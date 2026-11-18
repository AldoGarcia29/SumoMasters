import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Categoria, CategoriaSchema } from '../categorias/schemas/categoria.schema';
import { User, UserSchema } from '../common/schemas/user.schema';
import { Robot, RobotSchema } from '../robots/schemas/robot.schema';
import { Seguilineas, SeguilineasSchema } from './schemas/seguilineas.schema';
import { SeguilineasEventsService } from './seguilineas-events.service';
import { SeguilineasController } from './seguilineas.controller';
import { SeguilineasService } from './seguilineas.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Seguilineas.name, schema: SeguilineasSchema },
      { name: Robot.name, schema: RobotSchema },
      { name: User.name, schema: UserSchema },
      { name: Categoria.name, schema: CategoriaSchema },
    ]),
  ],
  controllers: [SeguilineasController],
  providers: [SeguilineasService, SeguilineasEventsService],
})
export class SeguilineasModule {}
