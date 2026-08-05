import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { Role } from '../users/enums/role.enum';

@Controller('test')
export class TestController {
  @Public()
  @Get('public')
  publicRoute() {
    return {
      message: 'Ruta pública funcionando',
    };
  }

  @Roles(Role.USER, Role.STAFF, Role.ADMIN)
  @Get('user')
  userRoute(@CurrentUser() user: unknown) {
    return {
      message: 'Acceso permitido para USER',
      user,
    };
  }

  @Roles(Role.STAFF, Role.ADMIN)
  @Get('staff')
  staffRoute(@CurrentUser() user: unknown) {
    return {
      message: 'Acceso permitido para STAFF',
      user,
    };
  }

  @Roles(Role.ADMIN)
  @Get('admin')
  adminRoute(@CurrentUser() user: unknown) {
    return {
      message: 'Acceso permitido para ADMIN',
      user,
    };
  }
}
