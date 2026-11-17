import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Dojo, DojoSchema } from './schemas/dojo.schema';
import { DojosController } from './dojos.controller';
import { DojosService } from './dojos.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Dojo.name, schema: DojoSchema }])],
  controllers: [DojosController],
  providers: [DojosService],
  exports: [DojosService],
})
export class DojosModule {}
