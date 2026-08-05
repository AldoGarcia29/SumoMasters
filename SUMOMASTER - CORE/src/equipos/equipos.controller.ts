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
import { CreateEquipoDto } from './dto/create-equipo.dto';
import { UpdateEquipoDto } from './dto/update-equipo.dto';
import { EquiposService } from './equipos.service';

@Controller('equipos')
export class EquiposController {
  constructor(private readonly equiposService: EquiposService) {}

  @Roles(Role.ADMIN, Role.STAFF)
  @Post()
  create(@Body() dto: CreateEquipoDto) {
    return this.equiposService.create(dto);
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('categoria') categoria?: string,
  ) {
    return this.equiposService.findAll({ search, categoria });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.equiposService.findOne(id);
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEquipoDto) {
    return this.equiposService.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.equiposService.remove(id);
  }
}
