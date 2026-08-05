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
