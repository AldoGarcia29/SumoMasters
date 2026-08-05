import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { EstadoTorneo } from '../enums/estado-torneo.enum';

export type TorneoDocument = HydratedDocument<Torneo>;

@Schema({
  collection: 'torneos',
  timestamps: true,
  versionKey: false,
})
export class Torneo {
  @Prop({ required: true, unique: true, trim: true })
  nombre: string;

  @Prop({ required: true })
  fecha: Date;

  @Prop({ trim: true, default: '' })
  descripcion: string;

  @Prop({ type: Types.ObjectId, ref: 'Categoria', required: true })
  categoria: Types.ObjectId;

  @Prop({
    type: String,
    enum: EstadoTorneo,
    default: EstadoTorneo.PROGRAMADO,
  })
  estado: EstadoTorneo;

  /** Robots inscritos que participarán en este torneo. */
  @Prop({ type: [Types.ObjectId], ref: 'Robot', default: [] })
  robotsInscritos: Types.ObjectId[];

  /** Tamaño de bloque usado en la fase de grupos (por defecto 16). */
  @Prop({ default: 16, min: 2 })
  tamanioBloque: number;
}

export const TorneoSchema = SchemaFactory.createForClass(Torneo);
