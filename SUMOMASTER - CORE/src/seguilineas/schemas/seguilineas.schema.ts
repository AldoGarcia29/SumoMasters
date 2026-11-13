import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { EstadoTorneo } from '../../torneos/enums/estado-torneo.enum';

export type SeguilineasDocument = HydratedDocument<Seguilineas>;

@Schema({ _id: false })
export class IntentoSeguilineas {
  @Prop({ type: Number, required: true, min: 1 }) tiempoMs: number;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) registradoPor: Types.ObjectId;
  @Prop({ type: Date, default: () => new Date() }) registradoEn: Date;
}
const IntentoSchema = SchemaFactory.createForClass(IntentoSeguilineas);

@Schema({ _id: false })
export class ParticipanteSeguilineas {
  @Prop({ type: Types.ObjectId, ref: 'Robot', required: true }) robot: Types.ObjectId;
  /** Orden de llegada (1..n), define la posición mientras no haya tiempos. */
  @Prop({ type: Number, required: true, min: 1 }) ordenLlegada: number;
  @Prop({ type: [IntentoSchema], default: [] }) intentos: IntentoSeguilineas[];
  /** Sin default a propósito: ausente = sin tiempo ($min lo inicializa al primer registro). */
  @Prop({ type: Number }) mejorTiempoMs?: number;
}
const ParticipanteSchema = SchemaFactory.createForClass(ParticipanteSeguilineas);

@Schema({ collection: 'seguilineas', timestamps: true, versionKey: false })
export class Seguilineas {
  @Prop({ required: true, unique: true, trim: true }) nombre: string;
  @Prop({ required: true }) fecha: Date;
  @Prop({ trim: true, default: '' }) descripcion: string;
  @Prop({ type: String, enum: ['seguilineas'], default: 'seguilineas', immutable: true }) categoria: 'seguilineas';
  @Prop({ type: String, enum: EstadoTorneo, default: EstadoTorneo.PROGRAMADO }) estado: EstadoTorneo;
  /** STAFF autorizado a registrar tiempos en este torneo. */
  @Prop({ type: [Types.ObjectId], ref: 'User', default: [], index: true }) staffAsignados: Types.ObjectId[];
  @Prop({ type: [ParticipanteSchema], default: [] }) participantes: ParticipanteSeguilineas[];
  @Prop({ type: Number, default: 0, min: 0 }) ultimoOrden: number;
}
export const SeguilineasSchema = SchemaFactory.createForClass(Seguilineas);
