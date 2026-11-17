import { IsEnum } from 'class-validator';
import { Role } from '../enums/role.enum';

export class UpdateRoleDto {
  @IsEnum(Role, {
    message: 'El rol permitido es USER, STAFF o ADMIN',
  })
  role: Role;
}
