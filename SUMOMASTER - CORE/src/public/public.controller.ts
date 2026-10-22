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
import { Public } from '../common/decorators/public.decorator';
import { PublicService } from './public.service';

/*
 * Rutas finales:
 *   GET /public/torneos
 *   GET /public/torneos/:id/live
 *   GET /public/torneos/:id/ranking
 * (si tu main.ts usa setGlobalPrefix('api'), serán /api/public/...)
 *
 * IMPORTANTE: si tienes un guard de auth GLOBAL (APP_GUARD con JWT),
 * marca este controller como público con el decorador que ya uses,
 * por ejemplo @Public() — AJUSTA importándolo aquí.
 */
@Public()
@Controller('public')
@UseGuards(ThrottlerGuard)
export class PublicController {
  constructor(private readonly service: PublicService) {}

  @Get('torneos')
  @Header('Cache-Control', 'public, max-age=5')
  lista() {
    return this.service.listarTorneosPublicos();
  }

  @Get('torneos/:id/live')
  @Header('Cache-Control', 'public, max-age=5')
  async live(@Param('id') id: string) {
    if (!/^[a-f\d]{24}$/i.test(id))
      throw new BadRequestException('id inválido');

    const data = await this.service.armarLive(id);
    if (!data) throw new NotFoundException('Torneo no encontrado');
    return data;
  }

  @Get('torneos/:id/ranking')
  @Header('Cache-Control', 'public, max-age=5')
  async ranking(@Param('id') id: string) {
    if (!/^[a-f\d]{24}$/i.test(id))
      throw new BadRequestException('id inválido');

    const data = await this.service.armarRanking(id);
    if (!data) throw new NotFoundException('Torneo no encontrado');
    return data;
  }

  @Get('torneos/:id/robots/:robotId/ficha')
  @Header('Cache-Control', 'public, max-age=5')
  async fichaRobot(@Param('id') id: string, @Param('robotId') robotId: string) {
    if (!/^[a-f\d]{24}$/i.test(id) || !/^[a-f\d]{24}$/i.test(robotId)) {
      throw new BadRequestException('id inválido');
    }

    const ficha = await this.service.armarFichaRobot(id, robotId);
    if (!ficha) throw new NotFoundException('Robot o torneo no encontrado');
    return ficha;
  }
}
