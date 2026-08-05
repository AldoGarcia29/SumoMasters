import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EquipoDocument = HydratedDocument<Equipo>;

@Schema({ _id: false })
export class Integrante {
  @Prop({ required: true, trim: true })
  nombre: string;

  @Prop({ trim: true, default: '' })
  rol: string;
}

export const IntegranteSchema = SchemaFactory.createForClass(Integrante);

@Schema({
  collection: 'equipos',
  timestamps: true,
  versionKey: false,
})
export class Equipo {
  @Prop({ required: true, unique: true, trim: true })
  nombre: string;

  @Prop({ required: true, trim: true })
  institucion: string;

  @Prop({ type: Types.ObjectId, ref: 'Categoria', required: true })
  categoria: Types.ObjectId;

  @Prop({ type: [IntegranteSchema], default: [] })
  integrantes: Integrante[];

  /**
   * Se mantiene sincronizado por el módulo de Robots cuando se crea/elimina
   * un robot asociado a este equipo. Mientras tanto, valor calculado en 0.
   */
  @Prop({ default: 0, min: 0 })
  robotsCount: number;

  @Prop({ trim: true, default: '' })
  logoIniciales: string;

  /** Puede ser una URL externa o una imagen en base64 (data URL) subida desde el formulario. */
  @Prop({ default: '' })
  logoUrl: string;
}

export const EquipoSchema = SchemaFactory.createForClass(Equipo);
