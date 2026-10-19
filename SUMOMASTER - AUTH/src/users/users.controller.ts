import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from './enums/role.enum';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UsersService } from './users.service';
import { ParseObjectIdPipe } from '@nestjs/mongoose/dist/pipes/parse-object-id.pipe';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(Role.ADMIN)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Roles(Role.ADMIN)
  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.usersService.findById(id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/roles')
  updateRoles(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    return this.usersService.updateRoles(id, updateRoleDto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/activate')
  activate(@Param('id', ParseObjectIdPipe) id: string) {
    return this.usersService.changeActiveStatus(id, true);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/deactivate')
  deactivate(@Param('id', ParseObjectIdPipe) id: string) {
    return this.usersService.changeActiveStatus(id, false);
  }
}
