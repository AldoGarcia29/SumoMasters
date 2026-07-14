import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CategoriasService } from './categorias.service';
import { CategoriasController } from './categorias.controller';
import {
  Categoria,
  CategoriaSchema,
} from './schemas/categoria.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Categoria.name,
        schema: CategoriaSchema,
      },
    ]),
  ],
  controllers: [CategoriasController],
  providers: [CategoriasService],
  exports: [MongooseModule, CategoriasService],
})
export class CategoriasModule {}