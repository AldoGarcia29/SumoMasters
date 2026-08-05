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

@Controller('torneos')
export class TorneosController {
  constructor(private readonly torneosService: TorneosService) {}

  @Roles(Role.ADMIN, Role.STAFF)
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

  @Roles(Role.ADMIN, Role.STAFF)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTorneoDto) {
    return this.torneosService.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.torneosService.remove(id);
  }
}
