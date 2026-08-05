import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Equipo, EquipoSchema } from './schemas/equipo.schema';
import { EquiposController } from './equipos.controller';
import { EquiposService } from './equipos.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Equipo.name, schema: EquipoSchema }]),
  ],
  controllers: [EquiposController],
  providers: [EquiposService],
  exports: [EquiposService],
})
export class EquiposModule {}
