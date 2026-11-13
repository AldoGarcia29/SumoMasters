import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../common/interfaces/jwt-payload.interface';
import { AsignarStaffSeguilineasDto, CreateSeguilineasDto, InscribirRobotSeguilineasDto, RegistrarTiempoDto } from './dto/seguilineas.dto';
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
  @Patch(':id/staff')
  asignarStaff(@Param('id') id: string, @Body() dto: AsignarStaffSeguilineasDto) {
    return this.service.asignarStaff(id, dto);
  }

  @Roles(Role.ADMIN)
  @Post(':id/participantes')
  inscribir(@Param('id') id: string, @Body() dto: InscribirRobotSeguilineasDto) {
    return this.service.inscribirRobot(id, dto);
  }

  // ── STAFF (y ADMIN): RolesGuard evalúa con OR; el servicio limita al STAFF a su torneo asignado ──
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
  registrarTiempo(@Param('id') id: string, @Body() dto: RegistrarTiempoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.registrarTiempo(id, dto, user);
  }

  // ── USER / PÚBLICO: solo lectura ──
  @Public() @Get()
  listar() {
    return this.service.listarPublicos();
  }

  @Public() @Get('activo')
  activo() {
    return this.service.activo();
  }

  @Public() @Get(':id/ranking')
  ranking(@Param('id') id: string) {
    return this.service.ranking(id);
  }
}
