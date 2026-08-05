import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Bloque, BloqueSchema } from '../bloques/schemas/bloque.schema';
import { Dojo, DojoSchema } from '../dojos/schemas/dojo.schema';
import { Combate, CombateSchema } from './schemas/combate.schema';
import { CombatesController } from './combates.controller';
import { CombatesService } from './combates.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Combate.name, schema: CombateSchema },
      { name: Bloque.name, schema: BloqueSchema },
      { name: Dojo.name, schema: DojoSchema },
    ]),
  ],
  controllers: [CombatesController],
  providers: [CombatesService],
  exports: [CombatesService],
})
export class CombatesModule {}
