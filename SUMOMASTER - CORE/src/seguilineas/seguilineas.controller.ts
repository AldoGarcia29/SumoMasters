import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import {
  AsignarStaffSeguilineasDto,
  CambiarTurnoDto,
  CreateSeguilineasDto,
  EditarRegistroDto,
  FinalizarSeguilineasDto,
  InscribirRobotSeguilineasDto,
  OrdenPodioDto,
  RegistrarTiempoDto,
  ReordenarColaDto,
  UpdateSeguilineasDto,
} from './dto/seguilineas.dto';
import { SeguilineasService } from './seguilineas.service';

@Controller('seguilineas')
export class SeguilineasController {
  constructor(private readonly service: SeguilineasService) {}

  // ── ADMIN ──
  @Roles(Role.ADMIN)
  @Post()
  crear(@Body() dto: CreateSeguilineasDto) {
    return this.service.crear(dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  editar(@Param('id') id: string, @Body() dto: UpdateSeguilineasDto) {
    return this.service.editar(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  eliminar(@Param('id') id: string) {
    return this.service.eliminar(id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/staff')
  asignarStaff(
    @Param('id') id: string,
    @Body() dto: AsignarStaffSeguilineasDto,
  ) {
    return this.service.asignarStaff(id, dto);
  }

  @Roles(Role.ADMIN)
  @Post(':id/participantes')
  inscribir(
    @Param('id') id: string,
    @Body() dto: InscribirRobotSeguilineasDto,
  ) {
    return this.service.inscribirRobot(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id/participantes/:robotId')
  quitarRobot(@Param('id') id: string, @Param('robotId') robotId: string) {
    return this.service.quitarRobot(id, robotId);
  }

  // ── STAFF (y ADMIN) ──
  @Roles(Role.ADMIN, Role.STAFF)
  @Get('mis-torneos')
  misTorneos(@CurrentUser() user: AuthenticatedUser) {
    return this.service.misTorneos(user);
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Get(':id/gestion')
  gestion(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.gestion(id, user);
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Post(':id/tiempos')
  registrarTiempo(
    @Param('id') id: string,
    @Body() dto: RegistrarTiempoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.registrarTiempo(id, dto, user);
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Patch(':id/tiempos/:robotId')
  editarTiempo(
    @Param('id') id: string,
    @Param('robotId') robotId: string,
    @Body() dto: EditarRegistroDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.modificarIntento(id, robotId, dto, user);
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Delete(':id/tiempos/:robotId')
  eliminarTiempo(
    @Param('id') id: string,
    @Param('robotId') robotId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.modificarIntento(id, robotId, null, user);
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Patch(':id/cola')
  reordenarCola(
    @Param('id') id: string,
    @Body() dto: ReordenarColaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.reordenarCola(id, dto, user);
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Patch(':id/turno/:robotId')
  marcarTurno(
    @Param('id') id: string,
    @Param('robotId') robotId: string,
    @Body() dto: CambiarTurnoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.marcarTurno(id, robotId, dto, user);
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Post(':id/finalizar')
  finalizar(
    @Param('id') id: string,
    @Body() dto: FinalizarSeguilineasDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.finalizar(id, dto, user);
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Patch(':id/podio')
  reordenarPodio(
    @Param('id') id: string,
    @Body() dto: OrdenPodioDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.reordenarPodio(id, dto, user);
  }

  // ── PÚBLICO ──
  @Public()
  @Get()
  listar(@Query('categoriaId') categoriaId?: string) {
    return this.service.listarPublicos(categoriaId);
  }

  @Public()
  @Get('activo')
  activo() {
    return this.service.activo();
  }

  // SSE: declarar antes de las rutas ':id/...'
  @Public()
  @Sse('stream/activo')
  streamActivo() {
    return this.service.streamActivo();
  }

  @Public()
  @Sse(':id/stream')
  stream(@Param('id') id: string) {
    return this.service.stream(id);
  }

  @Public()
  @Get(':id/ranking')
  ranking(@Param('id') id: string) {
    return this.service.ranking(id);
  }
}
