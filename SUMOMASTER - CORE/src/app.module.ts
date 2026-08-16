import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonAuthModule } from './common/auth/common-auth.module';
import { CategoriasModule } from './categorias/categorias.module';
import { EquiposModule } from './equipos/equipos.module';
import { RobotsModule } from './robots/robots.module';
import { TorneosModule } from './torneos/torneos.module';
import { DojosModule } from './dojos/dojos.module';
import { BloquesModule } from './bloques/bloques.module';
import { CombatesModule } from './combates/combates.module';
import { RankingModule } from './ranking/ranking.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('MONGODB_URI'),
        // Fuerza a leer siempre del nodo primario con la confirmación de
        // escritura más estricta disponible. Si la base de datos corre como
        // replica set (algo común incluso en instalaciones locales, p. ej.
        // MongoDB Atlas Local o Docker con réplica de un solo nodo), sin
        // esto una lectura inmediatamente después de un guardado podía caer
        // en un nodo secundario que todavía no había replicado ese dato —
        // lo que explica que un "generar" recién hecho no apareciera al
        // consultarlo justo después.
        readPreference: 'primary',
        writeConcern: { w: 'majority' },
      }),
    }),

    CommonAuthModule,

    // Módulos de negocio — se irán agregando módulo por módulo:
    CategoriasModule,
    EquiposModule,
    RobotsModule,
    TorneosModule,
    DojosModule,
    BloquesModule,
    CombatesModule,
    RankingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
