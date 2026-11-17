import { Role } from '../../users/enums/role.enum';

export interface JwtPayload {
  sub: string;
  username: string;
  email: string;
  roles: Role[];
}
