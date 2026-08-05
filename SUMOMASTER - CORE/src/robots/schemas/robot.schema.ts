import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { EstadoRobot } from '../enums/estado-robot.enum';

export type RobotDocument = HydratedDocument<Robot>;

@Schema({
  collection: 'robots',
  timestamps: true,
  versionKey: false,
})
export class Robot {
  @Prop({ required: true, trim: true })
  nombre: string;

  @Prop({ type: Types.ObjectId, ref: 'Equipo', required: true })
  equipo: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Categoria', required: true })
  categoria: Types.ObjectId;

  /** null = sin peso registrado (por ejemplo, robots retirados) */
  @Prop({ type: Number, default: null, min: 0 })
  pesoKg: number | null;

  @Prop({
    type: String,
    enum: EstadoRobot,
    default: EstadoRobot.ACTIVO,
  })
  estado: EstadoRobot;

  @Prop({ trim: true, default: '' })
  imagenUrl: string;
}

export const RobotSchema = SchemaFactory.createForClass(Robot);
