import { Controller, Get, Param, Query } from '@nestjs/common';
import { RankingService } from './ranking.service';

@Controller('torneos/:torneoId/ranking')
export class RankingController {
  constructor(private readonly rankingService: RankingService) {}

  @Get()
  calcular(
    @Param('torneoId') torneoId: string,
    @Query('bloque') bloque?: string,
    @Query('dojo') dojo?: string,
  ) {
    return this.rankingService.calcular(torneoId, { bloque, dojo });
  }
}
