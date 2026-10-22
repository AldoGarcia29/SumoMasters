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
import { Robot, RobotSchema } from '../robots/schemas/robot.schema';
import { Bloque, BloqueSchema } from '../bloques/schemas/bloque.schema';
import { Equipo, EquipoSchema } from '../equipos/schemas/equipo.schema';
import {
  Categoria,
  CategoriaSchema,
} from '../categorias/schemas/categoria.schema';
import { Dojo, DojoSchema } from '../dojos/schemas/dojo.schema';
import {
  Proyeccion,
  ProyeccionSchema,
} from './schemas/proyeccion.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Torneo.name, schema: TorneoSchema },
      { name: Combate.name, schema: CombateSchema },
      { name: Robot.name, schema: RobotSchema },
      { name: Bloque.name, schema: BloqueSchema },
      { name: Equipo.name, schema: EquipoSchema },
      { name: Categoria.name, schema: CategoriaSchema },
      { name: Dojo.name, schema: DojoSchema },
      { name: Proyeccion.name, schema: ProyeccionSchema },
    ]),
    RankingModule, // reutiliza RankingService.calcular() para el ranking público
    // 120 peticiones por minuto por IP (en un venue muchos comparten wifi; sube si hace falta)
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
  ],
  controllers: [PublicController, VersusController],
  providers: [PublicService, PublicCacheService],
  exports: [PublicCacheService, PublicService],
})
export class PublicModule {}
