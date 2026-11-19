import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Torneo, TorneoSchema } from '../torneos/schemas/torneo.schema';
import { EventoController } from './evento.controller';
import { EventoService } from './evento.service';
import {
  EventoConfig,
  EventoConfigSchema,
} from './schemas/evento-config.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EventoConfig.name, schema: EventoConfigSchema },
      { name: Torneo.name, schema: TorneoSchema },
    ]),
  ],
  controllers: [EventoController],
  providers: [EventoService],
})
export class EventoModule {}
