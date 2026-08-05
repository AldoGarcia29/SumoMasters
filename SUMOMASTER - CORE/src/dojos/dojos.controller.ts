import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateDojoDto } from './dto/create-dojo.dto';
import { UpdateDojoDto } from './dto/update-dojo.dto';
import { DojosService } from './dojos.service';

@Controller('dojos')
export class DojosController {
  constructor(private readonly dojosService: DojosService) {}

  @Roles(Role.ADMIN, Role.STAFF)
  @Post()
  create(@Body() dto: CreateDojoDto) {
    return this.dojosService.create(dto);
  }

  @Get()
  findAll() {
    return this.dojosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.dojosService.findOne(id);
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDojoDto) {
    return this.dojosService.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.dojosService.remove(id);
  }
}
