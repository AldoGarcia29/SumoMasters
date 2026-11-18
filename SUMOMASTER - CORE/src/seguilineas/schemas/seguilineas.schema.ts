import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { EstadoTorneo } from '../../torneos/enums/estado-torneo.enum';
import {
  AccionAuditoria,
  EstadoRegistro,
  EstadoTurno,
} from '../enums/seguilineas.enums';

export type SeguilineasDocument = HydratedDocument<Seguilineas>;

@Schema({ _id: false })
export class RegistroSeguilineas {
  @Prop({ type: String, enum: EstadoRegistro, required: true })
  estado: EstadoRegistro;
  /** Solo presente cuando estado === VALIDO. */
  @Prop({ type: Number, min: 1 }) tiempoMs?: number;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  registradoPor: Types.ObjectId;
  @Prop({ type: Date, default: () => new Date() }) registradoEn: Date;
}
const RegistroSchema = SchemaFactory.createForClass(RegistroSeguilineas);

@Schema({ _id: false })
export class ValorAnteriorSeguilineas {
  @Prop({ type: String, enum: EstadoRegistro }) estado?: EstadoRegistro;
  @Prop({ type: Number }) tiempoMs?: number;
}
const ValorAnteriorSchema = SchemaFactory.createForClass(
  ValorAnteriorSeguilineas,
);

@Schema({ _id: false })
export class AuditoriaSeguilineas {
  @Prop({ type: String, enum: AccionAuditoria, required: true })
  accion: AccionAuditoria;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  editadoPor: Types.ObjectId;
  @Prop({ type: Date, default: () => new Date() }) editadoEn: Date;
  @Prop({ type: ValorAnteriorSchema, default: undefined })
  valorAnterior?: ValorAnteriorSeguilineas;
}
const AuditoriaSchema = SchemaFactory.createForClass(AuditoriaSeguilineas);

@Schema({ _id: false })
export class ParticipanteSeguilineas {
  @Prop({ type: Types.ObjectId, ref: 'Robot', required: true })
  robot: Types.ObjectId;
  /** Turno de salida (1..n). Reordenable. */
  @Prop({ type: Number, required: true, min: 1 }) ordenLlegada: number;
  @Prop({ type: String, enum: EstadoTurno, default: EstadoTurno.EN_ESPERA })
  estadoTurno: EstadoTurno;
  /** Único registro conservado: el mejor tiempo válido (o DNF/DESCALIFICADO). */
  @Prop({ type: RegistroSchema, default: undefined })
  registro?: RegistroSeguilineas;
  /** Desnormalizado: tiempo del registro VALIDO; ausente en otro caso. */
  @Prop({ type: Number }) mejorTiempoMs?: number;
  /** Versión para control optimista de concurrencia. */
  @Prop({ type: Number, default: 0 }) rev: number;
  @Prop({ type: AuditoriaSchema, default: undefined })
  auditoria?: AuditoriaSeguilineas;
}
const ParticipanteSchema = SchemaFactory.createForClass(
  ParticipanteSeguilineas,
);

@Schema({ _id: false })
export class PodioSeguilineas {
  @Prop({ type: Types.ObjectId, ref: 'Robot', required: true })
  robot: Types.ObjectId;
  @Prop({ type: Number, required: true, min: 1 }) posicion: number;
  @Prop({ type: Number, required: true }) mejorTiempoMs: number;
}
const PodioSchema = SchemaFactory.createForClass(PodioSeguilineas);

@Schema({ collection: 'seguilineas', timestamps: true, versionKey: false })
export class Seguilineas {
  @Prop({ required: true, unique: true, trim: true }) nombre: string;
  @Prop({ required: true }) fecha: Date;
  @Prop({ trim: true, default: '' }) descripcion: string;
  @Prop({
    type: Types.ObjectId,
    ref: 'Categoria',
    required: true,
    immutable: true,
    index: true,
  })
  categoria: Types.ObjectId;
  @Prop({ type: String, enum: EstadoTorneo, default: EstadoTorneo.PROGRAMADO })
  estado: EstadoTorneo;
  @Prop({ type: [Types.ObjectId], ref: 'User', default: [], index: true })
  staffAsignados: Types.ObjectId[];
  @Prop({ type: [ParticipanteSchema], default: [] })
  participantes: ParticipanteSeguilineas[];
  @Prop({ type: Number, default: 0, min: 0 }) ultimoOrden: number;
  /** Orden final guardado (desempate manual / podio fijo al cerrar). */
  @Prop({ type: [PodioSchema], default: [] }) podio: PodioSeguilineas[];
  @Prop({ type: Types.ObjectId, ref: 'User' }) finalizadoPor?: Types.ObjectId;
  @Prop({ type: Date }) finalizadoEn?: Date;
}
export const SeguilineasSchema = SchemaFactory.createForClass(Seguilineas);
