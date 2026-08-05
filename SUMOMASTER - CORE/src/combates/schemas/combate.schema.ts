import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  EstadoCombate,
  FaseCombate,
  MetodoVictoria,
  ResultadoCombate,
} from '../enums/combate.enums';

export type CombateDocument = HydratedDocument<Combate>;

@Schema({ _id: false })
export class HistorialEvento {
  @Prop({ required: true })
  hora: Date;

  @Prop({ required: true, trim: true })
  descripcion: string;

  @Prop({ trim: true, default: 'info' })
  tipo: string; // info | warning | danger | success
}

export const HistorialEventoSchema = SchemaFactory.createForClass(HistorialEvento);

@Schema({
  collection: 'combates',
  timestamps: true,
  versionKey: false,
})
export class Combate {
  @Prop({ type: Types.ObjectId, ref: 'Torneo', required: true })
  torneo: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Bloque', default: null })
  bloque: Types.ObjectId | null;

  @Prop({
    type: String,
    enum: FaseCombate,
    default: FaseCombate.FASE_GRUPOS,
  })
  fase: FaseCombate;

  /** Número consecutivo del combate dentro de su bloque/fase (para mostrar "Combate #4"). */
  @Prop({ required: true, min: 1 })
  numero: number;

  @Prop({ type: Types.ObjectId, ref: 'Robot', required: true })
  robot1: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Robot', required: true })
  robot2: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Dojo', default: null })
  dojo: Types.ObjectId | null;

  @Prop({
    type: String,
    enum: EstadoCombate,
    default: EstadoCombate.PENDIENTE,
  })
  estado: EstadoCombate;

  @Prop({ type: String, enum: ResultadoCombate, default: null })
  resultado: ResultadoCombate | null;

  @Prop({ type: String, enum: MetodoVictoria, default: null })
  metodoVictoria: MetodoVictoria | null;

  /** Duración del combate en segundos. */
  @Prop({ type: Number, default: null })
  duracionSegundos: number | null;

  @Prop({ type: [String], default: [] })
  jueces: string[];

  @Prop({ trim: true, default: '' })
  observaciones: string;

  @Prop({ type: [HistorialEventoSchema], default: [] })
  historial: HistorialEvento[];
}

export const CombateSchema = SchemaFactory.createForClass(Combate);
