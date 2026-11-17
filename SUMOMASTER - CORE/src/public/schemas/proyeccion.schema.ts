import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProyeccionDocument = HydratedDocument<Proyeccion>;

@Schema({
  collection: 'proyecciones',
  timestamps: true,
  versionKey: false,
})
export class Proyeccion {
  @Prop({ type: String, required: true })
  _id!: string;

  @Prop({ type: Types.ObjectId, ref: 'Torneo', required: true })
  torneo!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Combate', default: null })
  combate!: Types.ObjectId | null;
}

export const ProyeccionSchema =
  SchemaFactory.createForClass(Proyeccion);