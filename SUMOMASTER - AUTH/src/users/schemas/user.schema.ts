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

export const UserSchema = SchemaFactory.createForClass(User);
