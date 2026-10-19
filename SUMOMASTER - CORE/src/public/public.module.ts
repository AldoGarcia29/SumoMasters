import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';

// AJUSTA estos imports a tus schemas reales
import { Torneo, TorneoSchema } from '../torneos/schemas/torneo.schema';
import { Combate, CombateSchema } from '../combates/schemas/combate.schema';

import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { PublicCacheService } from './public-cache.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Torneo.name, schema: TorneoSchema },
      { name: Combate.name, schema: CombateSchema },
    ]),
    // 120 peticiones por minuto por IP (en un venue muchos comparten wifi; sube si hace falta)
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
  ],
  controllers: [PublicController],
  providers: [PublicService, PublicCacheService],
  exports: [PublicCacheService], // para invalidar el caché desde TorneosModule
})
export class PublicModule {}
