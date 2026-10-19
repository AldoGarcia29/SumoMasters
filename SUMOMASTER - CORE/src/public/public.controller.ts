import {
  BadRequestException,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

import { PublicService } from './public.service';
import { PublicCacheService } from './public-cache.service';
import {
  LISTA_KEY,
  LISTA_TTL_MS,
  LIVE_TTL_MS,
  liveKey,
} from './public.constants';

/*
 * Rutas finales:
 *   GET /public/torneos
 *   GET /public/torneos/:id/live
 * (si tu main.ts usa setGlobalPrefix('api'), serán /api/public/...)
 *
 * IMPORTANTE: si tienes un guard de auth GLOBAL (APP_GUARD con JWT),
 * marca este controller como público con el decorador que ya uses,
 * por ejemplo @Public() — AJUSTA importándolo aquí.
 */
@Controller('public')
@UseGuards(ThrottlerGuard)
export class PublicController {
  constructor(
    private readonly service: PublicService,
    private readonly cache: PublicCacheService,
  ) {}

  @Get('torneos')
  @Header('Cache-Control', 'public, max-age=30')
  lista() {
    return this.cache.wrap(LISTA_KEY, LISTA_TTL_MS, () =>
      this.service.listarTorneosPublicos(),
    );
  }

  @Get('torneos/:id/live')
  @Header('Cache-Control', 'public, max-age=5')
  async live(@Param('id') id: string) {
    if (!/^[a-f\d]{24}$/i.test(id)) throw new BadRequestException('id inválido');

    const data = await this.cache.wrap(liveKey(id), LIVE_TTL_MS, () =>
      this.service.armarLive(id),
    );
    if (!data) throw new NotFoundException('Torneo no encontrado');
    return data;
  }
}
