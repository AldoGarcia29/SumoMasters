export enum Role {
  USER = 'USER',
  STAFF = 'STAFF',
  ADMIN = 'ADMIN',
}

export interface LoginRequest {
  identifier: string; // username o correo
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  username: string;
  password: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  username: string;
  roles: Role[];
  active: boolean;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  user: AuthUser;
}

/** Forma en la que NestJS devuelve los errores de validación (class-validator) */
export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
}
