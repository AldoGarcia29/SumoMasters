import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { Roles } from '../common/decorators/roles.decorator';
import { CombatesService } from './combates.service';
import { AsignarDojoDto } from './dto/asignar-dojo.dto';
import { GenerarCombatesDto } from './dto/generar-combates.dto';
import { RegistrarResultadoDto } from './dto/registrar-resultado.dto';

@Controller()
export class CombatesController {
  constructor(private readonly combatesService: CombatesService) {}

  @Get('torneos/:torneoId/combates')
  findByTorneo(
    @Param('torneoId') torneoId: string,
    @Query('bloque') bloque?: string,
    @Query('dojo') dojo?: string,
    @Query('estado') estado?: string,
    @Query('fase') fase?: string,
  ) {
    return this.combatesService.findByTorneo(torneoId, { bloque, dojo, estado, fase });
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Post('torneos/:torneoId/combates/generar')
  generar(@Param('torneoId') torneoId: string, @Body() dto: GenerarCombatesDto) {
    return this.combatesService.generar(torneoId, dto);
  }

  @Get('torneos/:torneoId/dojos-resumen')
  resumenDojos(@Param('torneoId') torneoId: string) {
    return this.combatesService.resumenDojos(torneoId);
  }

  @Get('combates-stats')
  statsGlobal() {
    return this.combatesService.statsGlobal();
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Post('torneos/:torneoId/combates/asignar-dojos-auto')
  asignarDojosAutomatico(
    @Param('torneoId') torneoId: string,
    @Query('fase') fase?: string,
  ) {
    return this.combatesService.asignarDojosAutomatico(torneoId, fase);
  }

  @Get('combates/:id')
  findOne(@Param('id') id: string) {
    return this.combatesService.findOne(id);
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Patch('combates/:id/dojo')
  asignarDojo(@Param('id') id: string, @Body() dto: AsignarDojoDto) {
    return this.combatesService.asignarDojo(id, dto);
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Patch('combates/:id/quitar-dojo')
  quitarDojo(@Param('id') id: string) {
    return this.combatesService.quitarDojo(id);
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Patch('combates/:id/iniciar')
  iniciar(@Param('id') id: string) {
    return this.combatesService.iniciar(id);
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Patch('combates/:id/resultado')
  registrarResultado(@Param('id') id: string, @Body() dto: RegistrarResultadoDto) {
    return this.combatesService.registrarResultado(id, dto);
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Patch('combates/:id/cancelar')
  cancelar(@Param('id') id: string) {
    return this.combatesService.cancelar(id);
  }
}
