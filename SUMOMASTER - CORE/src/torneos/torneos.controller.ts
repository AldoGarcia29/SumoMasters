import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateTorneoDto } from './dto/create-torneo.dto';
import { UpdateTorneoDto } from './dto/update-torneo.dto';
import { TorneosService } from './torneos.service';
import { UpdateHorarioDto } from '../public/dto/update-horario.dto';
import { UpdateVisibilidadDto } from '../public/dto/update-visibilidad.dto';

@Controller('torneos')
export class TorneosController {
  constructor(private readonly torneosService: TorneosService) {}

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateTorneoDto) {
    return this.torneosService.create(dto);
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('estado') estado?: string,
    @Query('categoria') categoria?: string,
  ) {
    return this.torneosService.findAll({ search, estado, categoria });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.torneosService.findOne(id);
  }

  @Get(':id/robots/:robotId/ficha')
  fichaRobot(
    @Param('id') id: string,
    @Param('robotId') robotId: string,
  ) {
    return this.torneosService.fichaRobot(id, robotId);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTorneoDto) {
    return this.torneosService.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.torneosService.remove(id);
  }

  @Roles(Role.USER)
  @Patch(':id/horario')
  actualizarHorario(@Param('id') id: string, @Body() dto: UpdateHorarioDto) {
    return this.torneosService.actualizarHorario(id, dto);
  }

  @Roles(Role.USER)
  @Patch(':id/publico')
  cambiarVisibilidad(
    @Param('id') id: string,
    @Body() dto: UpdateVisibilidadDto,
  ) {
    return this.torneosService.cambiarVisibilidad(id, dto.publico);
  }
}
