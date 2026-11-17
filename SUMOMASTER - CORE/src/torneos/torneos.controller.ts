import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
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
import { GenerarGruposDto } from './dto/generar-grupos.dto';
import { RegistrarResultadoGrupoDto } from './dto/registrar-resultado-grupo.dto';
import { IsMongoId } from 'class-validator';
import { GuardarLlaveRoboSoccerDto } from './dto/guardar-llave-robo-soccer.dto';


class ElegirGanadorRoboSoccerDto {
  @IsMongoId()
  ganadorId!: string;
}
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

  @Roles(Role.ADMIN)
@Post(':id/grupos/generar')
generarGrupos(@Param('id') id: string, @Body() dto: GenerarGruposDto) {
  return this.torneosService.generarGrupos(id, dto.cantidadGrupos);
}

@Roles(Role.ADMIN)
@Patch(':id/grupos/:numeroGrupo/resultado')
registrarResultadoGrupo(
  @Param('id') id: string,
  @Param('numeroGrupo', ParseIntPipe) numeroGrupo: number,
  @Body() dto: RegistrarResultadoGrupoDto,
) {
  return this.torneosService.registrarResultadoGrupo(id, numeroGrupo, dto);
}
@Roles(Role.ADMIN)
@Get(':id/llave-robo-soccer')
consultarLlaveRoboSoccer(@Param('id') id: string) {
  return this.torneosService.consultarLlaveRoboSoccer(id);
}

@Roles(Role.ADMIN)
@Patch(':id/llave-robo-soccer')
guardarLlaveRoboSoccer(
  @Param('id') id: string,
  @Body() dto: GuardarLlaveRoboSoccerDto,
) {
  return this.torneosService.guardarLlaveRoboSoccer(id, dto);
}

@Roles(Role.ADMIN)
@Patch(':id/llave-robo-soccer/cruces/:cruceId/ganador')
elegirGanadorRoboSoccer(
  @Param('id') id: string,
  @Param('cruceId') cruceId: string,
  @Body() dto: ElegirGanadorRoboSoccerDto,
) {
  return this.torneosService.elegirGanadorRoboSoccer(id, cruceId, dto.ganadorId);
}
}
