import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type EventoConfigDocument = HydratedDocument<EventoConfig>;

@Schema({ collection: 'configuracion_evento', timestamps: true, versionKey: false })
export class EventoConfig {
  @Prop({ required: true, unique: true, default: 'principal' })
  clave: string;

  @Prop({ required: true, trim: true, default: 'BATTLEBOT UTEQ 2026' })
  nombreEvento: string;

  @Prop({ trim: true, default: '' })
  lema: string;
}

export const EventoConfigSchema = SchemaFactory.createForClass(EventoConfig);
