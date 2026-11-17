import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const user = await this.usersService.create(
      registerDto.name,
      registerDto.email,
      registerDto.username,
      registerDto.password,
    );

    return this.generateAuthenticationResponse(user);
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findForAuthentication(
      loginDto.identifier,
    );

    if (!user) {
      throw new UnauthorizedException(
        'Usuario, correo o contraseña incorrectos',
      );
    }

    if (!user.active) {
      throw new UnauthorizedException('La cuenta se encuentra desactivada');
    }

    const validPassword = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!validPassword) {
      throw new UnauthorizedException(
        'Usuario, correo o contraseña incorrectos',
      );
    }

    return this.generateAuthenticationResponse(user);
  }

  private async generateAuthenticationResponse(user: any) {
    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      roles: user.roles,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        roles: user.roles,
        active: user.active,
      },
    };
  }
}
