import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { RobotsService } from './robots.service';
import { CreateRobotDto } from './dto/create-robot.dto';
import { UpdateRobotDto } from './dto/update-robot.dto';

@Controller('robots')
export class RobotsController {
  constructor(
    private readonly robotsService: RobotsService,
  ) {}

  @Post()
  create(@Body() createRobotDto: CreateRobotDto) {
    return this.robotsService.create(createRobotDto);
  }

  @Get()
  findAll() {
    return this.robotsService.findAll();
  }

  @Get('equipo/:equipoId')
  findByEquipo(
    @Param('equipoId') equipoId: string,
  ) {
    return this.robotsService.findByEquipo(equipoId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.robotsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateRobotDto: UpdateRobotDto,
  ) {
    return this.robotsService.update(
      id,
      updateRobotDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.robotsService.remove(id);
  }
}