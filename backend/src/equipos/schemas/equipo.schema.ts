import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EquipoDocument = HydratedDocument<Equipo>;

@Schema({
  timestamps: true,
  collection: 'equipos',
})
export class Equipo {
  @Prop({
    required: true,
    trim: true,
  })
  nombreEquipo!: string;

  @Prop({
    required: true,
    trim: true,
  })
  institucion!: string;

  @Prop({
    type: [String],
    required: true,
    default: [],
  })
  integrantes!: string[];

  @Prop({
    type: Types.ObjectId,
    ref: 'Categoria',
    required: true,
  })
  categoriaId!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Torneo',
    required: true,
  })
  torneoId!: Types.ObjectId;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Robot' }],
    default: [],
  })
  robotIds!: Types.ObjectId[];
}

export const EquipoSchema = SchemaFactory.createForClass(Equipo);