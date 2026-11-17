import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Role } from '../enums/role.enum';

export type UserDocument = HydratedDocument<User>;

@Schema({
  collection: 'usuarios',
  timestamps: true,
  versionKey: false,
})
export class User {
  @Prop({
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 100,
  })
  name: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  email: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  username: string;

  @Prop({
    required: true,
    select: false,
  })
  password: string;

  @Prop({
    type: [String],
    enum: Role,
    default: [Role.USER],
  })
  roles: Role[];

  @Prop({
    default: true,
  })
  active: boolean;
}

// 1. PRIMERO creas el esquema
export const UserSchema = SchemaFactory.createForClass(User);

// 2. DESPUÉS lo configuras
// Expone "id" (string) en lugar de "_id" al serializar a JSON, para que
// coincida con la interfaz AuthUser del frontend (login ya devuelve "id").
UserSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret: Record<string, any>) => {
    delete ret._id;
    delete ret.password;
    return ret;
  },
});
