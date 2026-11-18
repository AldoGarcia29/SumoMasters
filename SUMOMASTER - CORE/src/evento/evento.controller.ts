import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UpdateEventoConfigDto } from './dto/update-evento-config.dto';
import { EventoService } from './evento.service';

@Controller('evento/configuracion')
export class EventoController {
  constructor(private readonly eventoService: EventoService) {}

  @Public()
  @Get()
  obtenerConfiguracion() {
    return this.eventoService.obtenerConfiguracion();
  }

  @Roles(Role.ADMIN)
  @Patch()
  actualizarConfiguracion(@Body() dto: UpdateEventoConfigDto) {
    return this.eventoService.actualizarConfiguracion(dto);
  }
}
