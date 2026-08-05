import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { PassportStrategy } from '@nestjs/passport';
import { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser, JwtPayload } from '../interfaces/jwt-payload.interface';
import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.userModel.findById(payload.sub).exec();

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (!user.active) {
      throw new UnauthorizedException('La cuenta se encuentra desactivada');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      roles: user.roles,
      active: user.active,
    };
  }
}
