import { ArrayMinSize, IsArray, IsEnum } from 'class-validator';
import { Role } from '../enums/role.enum';

export class UpdateRoleDto {
  @IsArray({
    message: 'Los roles deben enviarse como un arreglo',
  })
  @ArrayMinSize(1, {
    message: 'Debe seleccionar al menos un rol',
  })
  @IsEnum(Role, {
    each: true,
    message: 'Los roles permitidos son USER, STAFF y ADMIN',
  })
  roles: Role[];
}
