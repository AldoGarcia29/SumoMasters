import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CategoriaDocument = HydratedDocument<Categoria>;

export enum TipoCombate {
  SUMO = 'Sumo',
  AUTONOMO = 'Autónomo',
  RADIO_CONTROL = 'Radio Control',
}

export enum EstadoCategoria {
  ACTIVA = 'activa',
  INACTIVA = 'inactiva',
}

@Schema({
  timestamps: true,
  collection: 'categorias',
})
export class Categoria {
  @Prop({
    required: true,
    trim: true,
    unique: true,
  })
  nombre!: string;

  @Prop({
    required: true,
    trim: true,
  })
  descripcion!: string;

  @Prop({
    required: true,
    min: 0,
  })
  pesoMaximo!: number;

  @Prop({
    required: true,
    enum: TipoCombate,
  })
  tipoCombate!: TipoCombate;

  @Prop({
    required: true,
    trim: true,
  })
  reglas!: string;

  @Prop({
    required: true,
    enum: EstadoCategoria,
    default: EstadoCategoria.ACTIVA,
  })
  estado!: EstadoCategoria;
}

export const CategoriaSchema =
  SchemaFactory.createForClass(Categoria);