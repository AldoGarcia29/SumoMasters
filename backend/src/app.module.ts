import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { EquiposModule } from './equipos/equipos.module';
import { RobotsModule } from './robots/robots.module';
import { CategoriasModule } from './categorias/categorias.module';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/sumomaster'),

    EquiposModule,
    RobotsModule,
    CategoriasModule,
  ],
})
export class AppModule {}