import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { Roles } from '../common/decorators/roles.decorator';
import { BloquesService } from './bloques.service';
import { GenerarBloquesDto } from './dto/generar-bloques.dto';

@Controller('torneos/:torneoId/bloques')
export class BloquesController {
  constructor(private readonly bloquesService: BloquesService) {}

  @Get()
  findAll(@Param('torneoId') torneoId: string) {
    return this.bloquesService.findByTorneo(torneoId);
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Post('generar')
  generar(@Param('torneoId') torneoId: string, @Body() dto: GenerarBloquesDto) {
    return this.bloquesService.generar(torneoId, dto);
  }
}
