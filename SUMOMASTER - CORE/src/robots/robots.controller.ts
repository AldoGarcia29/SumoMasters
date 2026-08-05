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
import { CreateRobotDto } from './dto/create-robot.dto';
import { UpdateRobotDto } from './dto/update-robot.dto';
import { RobotsService } from './robots.service';

@Controller('robots')
export class RobotsController {
  constructor(private readonly robotsService: RobotsService) {}

  @Roles(Role.ADMIN, Role.STAFF)
  @Post()
  create(@Body() dto: CreateRobotDto) {
    return this.robotsService.create(dto);
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('equipo') equipo?: string,
    @Query('categoria') categoria?: string,
    @Query('estado') estado?: string,
  ) {
    return this.robotsService.findAll({ search, equipo, categoria, estado });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.robotsService.findOne(id);
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRobotDto) {
    return this.robotsService.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.robotsService.remove(id);
  }
}
