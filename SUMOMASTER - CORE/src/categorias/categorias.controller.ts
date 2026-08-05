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
import { CategoriasService } from './categorias.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';

@Controller('categorias')
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  @Roles(Role.ADMIN, Role.STAFF)
  @Post()
  create(@Body() dto: CreateCategoriaDto) {
    return this.categoriasService.create(dto);
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('estado') estado?: string,
  ) {
    return this.categoriasService.findAll({ search, estado });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.categoriasService.findOne(id);
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoriaDto) {
    return this.categoriasService.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoriasService.remove(id);
  }
}
