import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RobotDocument = HydratedDocument<Robot>;

export enum EstadoRobot {
  ACTIVO = 'activo',
  ELIMINADO = 'eliminado',
  EN_ESPERA = 'en espera',
  RETIRADO = 'retirado',
}

@Schema({
  timestamps: true,
  collection: 'robots',
})
export class Robot {
  @Prop({
    required: true,
    trim: true,
  })
  nombreRobot!: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'Equipo',
    required: true,
  })
  equipoId!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Categoria',
    required: true,
  })
  categoriaId!: Types.ObjectId;

  @Prop({
    required: true,
    min: 0,
  })
  peso!: number;

  @Prop({
    required: true,
    min: 0,
  })
  fuerza!: number;

  @Prop({
    required: true,
    min: 0,
  })
  fuerzaNeta!: number;

  @Prop({
    required: true,
    enum: EstadoRobot,
    default: EstadoRobot.EN_ESPERA,
  })
  estado!: EstadoRobot;

  @Prop({
    required: false,
    default: null,
  })
  imagenUrl?: string;
}

export const RobotSchema = SchemaFactory.createForClass(Robot);