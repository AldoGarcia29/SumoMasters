import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';

// AJUSTA estos imports a tus schemas reales
import { Torneo, TorneoSchema } from '../torneos/schemas/torneo.schema';
import { Combate, CombateSchema } from '../combates/schemas/combate.schema';

import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { PublicCacheService } from './public-cache.service';
import { VersusController } from './versus.controller';
import { RankingModule } from '../ranking/ranking.module';
import {
  Proyeccion,
  ProyeccionSchema,
} from './schemas/proyeccion.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Torneo.name, schema: TorneoSchema },
      { name: Combate.name, schema: CombateSchema },
      { name: Proyeccion.name, schema: ProyeccionSchema },
    ]),
    RankingModule, // reutiliza RankingService.calcular() para el ranking público
    // 120 peticiones por minuto por IP (en un venue muchos comparten wifi; sube si hace falta)
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
  ],
  controllers: [PublicController, VersusController],
  providers: [PublicService, PublicCacheService],
  exports: [PublicCacheService], // para invalidar el caché desde TorneosModule
})
export class PublicModule {}
