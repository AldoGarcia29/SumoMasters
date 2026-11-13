import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Torneo, TorneoSchema } from './schemas/torneo.schema';
import { TorneosController } from './torneos.controller';
import { TorneosService } from './torneos.service';

import { PublicModule } from '../public/public.module';
import { Equipo, EquipoSchema } from '../equipos/schemas/equipo.schema';
@Module({
  imports: [
    MongooseModule.forFeature([
  { name: Torneo.name, schema: TorneoSchema },
  { name: Equipo.name, schema: EquipoSchema },
]),
    PublicModule,
  ],
  controllers: [TorneosController],
  providers: [TorneosService],
  exports: [TorneosService],
})
export class TorneosModule {}
