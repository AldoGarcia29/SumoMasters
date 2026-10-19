import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { Roles } from '../common/decorators/roles.decorator';
import { RankingService } from './ranking.service';
import { GenerarSiguienteRondaDto } from './dto/generar-siguiente-ronda.dto';

@Controller('torneos/:torneoId/ranking')
export class RankingController {
  constructor(
    private readonly rankingService: RankingService,
  ) {}

  /**
   * Obtiene la tabla general de posiciones.
   *
   * GET /torneos/:torneoId/ranking
   */
  @Get()
  calcular(
    @Param('torneoId') torneoId: string,
    @Query('bloque') bloque?: string,
    @Query('dojo') dojo?: string,
  ) {
    return this.rankingService.calcular(
      torneoId,
      {
        bloque,
        dojo,
      },
    );
  }

  /**
   * Obtiene los robots clasificados,
   * pases directos y ronda preliminar.
   *
   * GET /torneos/:torneoId/ranking/clasificados
   */
  @Get('clasificados')
  obtenerClasificados(
    @Param('torneoId') torneoId: string,
  ) {
    return this.rankingService.obtenerClasificados(
      torneoId,
    );
  }

  /**
   * Genera la primera fase eliminatoria después
   * de terminar la fase de grupos.
   *
   * POST /torneos/:torneoId/ranking/fase-eliminatoria/generar
   */
  @Roles(Role.ADMIN, Role.STAFF)
  @Post('fase-eliminatoria/generar')
  generarFaseEliminatoria(
    @Param('torneoId') torneoId: string,
  ) {
    return this.rankingService.generarFaseEliminatoria(
      torneoId,
    );
  }

  /**
   * Genera la ronda posterior usando los ganadores
   * de la fase actual.
   *
   * POST /torneos/:torneoId/ranking/siguiente-ronda/generar
   *
   * Body:
   * {
   *   "faseActual": "Octavos de final"
   * }
   */
  @Roles(Role.ADMIN, Role.STAFF)
  @Post('siguiente-ronda/generar')
  generarSiguienteRonda(
    @Param('torneoId') torneoId: string,
    @Body() dto: GenerarSiguienteRondaDto,
  ) {
    return this.rankingService.generarSiguienteRonda(
      torneoId,
      dto.faseActual,
    );
  }


  @Get('podio')
obtenerPodio(
  @Param('torneoId') torneoId: string,
) {
  return this.rankingService.obtenerPodio(
    torneoId,
  );
}
}