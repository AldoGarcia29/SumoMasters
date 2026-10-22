import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Delete,
} from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { Roles } from '../common/decorators/roles.decorator';
import { CombatesService } from './combates.service';
import { AsignacionesStaffService } from './asignaciones-staff.service';
import { CrearAsignacionStaffDto } from './dto/crear-asignacion-staff.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { AsignarDojoDto } from './dto/asignar-dojo.dto';
import { GenerarCombatesDto } from './dto/generar-combates.dto';
import { RegistrarResultadoDto } from './dto/registrar-resultado.dto';
import {
  FaseCombate,
} from './enums/combate.enums';

import { ActualizarHorarioCombateDto } from './dto/actualizar-horario-combate.dto';

@Controller()
export class CombatesController {
  constructor(
  private readonly combatesService: CombatesService,
  private readonly asignaciones: AsignacionesStaffService,
) {}

  @Roles(Role.ADMIN)
  @Post('asignaciones-staff')
  crearAsignacion(@Body() dto: CrearAsignacionStaffDto) {
    return this.asignaciones.crear(dto);
  }

  @Roles(Role.ADMIN)
  @Get('asignaciones-staff')
  listarAsignaciones(@Query('torneoId') torneoId?: string) {
    return this.asignaciones.listar(torneoId);
  }

  @Roles(Role.ADMIN)
  @Delete('asignaciones-staff/:id')
  eliminarAsignacion(@Param('id') id: string) {
    return this.asignaciones.eliminar(id);
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Get('mis-asignaciones')
  misAsignaciones(@CurrentUser() user: AuthenticatedUser) {
    return this.asignaciones.listar(undefined, user.id);
  }


  @Roles(Role.ADMIN)
@Patch('torneos/:torneoId/combates/:id/horario')
actualizarHorario(
  @Param('torneoId') torneoId: string,
  @Param('id') id: string,
  @Body() dto: ActualizarHorarioCombateDto,
) {
  return this.combatesService.actualizarHorario(
    torneoId,
    id,
    dto,
  );
}

  @Roles(Role.ADMIN, Role.STAFF)
  @Get('torneos/:torneoId/combates')
  findByTorneo(
    @Param('torneoId') torneoId: string,
    @Query('bloque') bloque?: string,
    @Query('dojo') dojo?: string,
    @Query('estado') estado?: string,
    @Query('fase') fase?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.combatesService.findByTorneo(torneoId, { bloque, dojo, estado, fase }, user);
  }

  @Roles(Role.ADMIN)
  @Post('torneos/:torneoId/combates/generar')
  generar(@Param('torneoId') torneoId: string, @Body() dto: GenerarCombatesDto) {
    return this.combatesService.generar(torneoId, dto);
  }

  @Roles(Role.ADMIN)
  @Get('torneos/:torneoId/dojos-resumen')
  resumenDojos(@Param('torneoId') torneoId: string) {
    return this.combatesService.resumenDojos(torneoId);
  }

  @Roles(Role.ADMIN)
  @Get('combates-stats')
  statsGlobal() {
    return this.combatesService.statsGlobal();
  }

    @Roles(Role.ADMIN)
  @Post('torneos/:torneoId/combates/asignar-dojos-auto')
  asignarDojosAutomatico(
    @Param('torneoId') torneoId: string,
    @Query('fase') fase: string | undefined,
    @Body('dojoIds') dojoIds: string[] | undefined,
  ) {
    return this.combatesService.asignarDojosAutomatico(
      torneoId,
      fase,
      dojoIds,
    );
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Get('combates/:id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.combatesService.findOne(id, user);
  }

  @Roles(Role.ADMIN)
  @Patch('combates/:id/dojo')
  asignarDojo(@Param('id') id: string, @Body() dto: AsignarDojoDto) {
    return this.combatesService.asignarDojo(id, dto);
  }

  @Roles(Role.ADMIN)
  @Patch('combates/:id/quitar-dojo')
  quitarDojo(@Param('id') id: string) {
    return this.combatesService.quitarDojo(id);
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Patch('combates/:id/iniciar')
  iniciar(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.combatesService.iniciar(id, user);
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Patch('combates/:id/resultado')
  registrarResultado(@Param('id') id: string, @Body() dto: RegistrarResultadoDto,
    @CurrentUser() user: AuthenticatedUser) {
    return this.combatesService.registrarResultado(id, dto, user);
  }

  @Roles(Role.ADMIN)
  @Patch('combates/:id/cancelar')
  cancelar(@Param('id') id: string) {
    return this.combatesService.cancelar(id);
  }

 @Roles(Role.ADMIN)
@Post(
  'torneos/:torneoId/combates/resultados-aleatorios',
)
registrarResultadosAleatorios(
  @Param('torneoId')
  torneoId: string,

  @Query('fase')
  fase?: FaseCombate,
) {
  return this.combatesService
    .registrarResultadosAleatorios(
      torneoId,
      fase,
    );
}
}
