import { Role } from '../enums/role.enum';

export interface JwtPayload {
  sub: string;
  username: string;
  email: string;
  roles: Role[];
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  username: string;
  roles: Role[];
  active: boolean;
}
