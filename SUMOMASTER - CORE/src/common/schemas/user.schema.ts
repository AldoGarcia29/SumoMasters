import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Role } from '../enums/role.enum';

export type UserDocument = HydratedDocument<User>;

/**
 * Este esquema apunta a la MISMA colección "usuarios" que gestiona
 * SUMOMASTER - AUTH. Aquí solo se usa en modo lectura para validar
 * el token y conocer el rol/estado activo del usuario autenticado.
 */
@Schema({
  collection: 'usuarios',
  timestamps: true,
  versionKey: false,
})
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, lowercase: true, trim: true })
  username: string;

  @Prop({ type: [String], enum: Role, default: [Role.USER] })
  roles: Role[];

  @Prop({ default: true })
  active: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
