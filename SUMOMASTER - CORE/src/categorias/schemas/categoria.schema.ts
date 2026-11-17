import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { EstadoCategoria, TipoCombate } from '../enums/categoria.enums';

export type CategoriaDocument = HydratedDocument<Categoria>;

@Schema({
  collection: 'categorias',
  timestamps: true,
  versionKey: false,
})
export class Categoria {
  @Prop({ required: true, unique: true, trim: true })
  nombre: string;

  @Prop({ required: true, trim: true })
  descripcion: string;

  /** En kilogramos. null = "Sin límite" (p. ej. Sumo Autónomo / Sumo RC) */
  @Prop({ type: Number, default: null, min: 0 })
  pesoMaximoKg: number | null;

  @Prop({ type: String, enum: TipoCombate, required: true })
  tipoCombate: TipoCombate;

  @Prop({
    type: String,
    enum: EstadoCategoria,
    default: EstadoCategoria.EN_PREPARACION,
  })
  estado: EstadoCategoria;

  /** Ícono/color visual asignado en el listado (opcional, para mantener el estilo del mockup) */
  @Prop({ trim: true, default: 'purple' })
  color: string;
}

export const CategoriaSchema = SchemaFactory.createForClass(Categoria);
