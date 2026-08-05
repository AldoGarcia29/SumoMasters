import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Torneo, TorneoSchema } from './schemas/torneo.schema';
import { TorneosController } from './torneos.controller';
import { TorneosService } from './torneos.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Torneo.name, schema: TorneoSchema }]),
  ],
  controllers: [TorneosController],
  providers: [TorneosService],
  exports: [TorneosService],
})
export class TorneosModule {}
