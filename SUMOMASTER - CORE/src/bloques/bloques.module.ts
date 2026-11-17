import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TorneosModule } from '../torneos/torneos.module';
import { Bloque, BloqueSchema } from './schemas/bloque.schema';
import { BloquesController } from './bloques.controller';
import { BloquesService } from './bloques.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Bloque.name, schema: BloqueSchema }]),
    TorneosModule,
  ],
  controllers: [BloquesController],
  providers: [BloquesService],
  exports: [BloquesService],
})
export class BloquesModule {}
