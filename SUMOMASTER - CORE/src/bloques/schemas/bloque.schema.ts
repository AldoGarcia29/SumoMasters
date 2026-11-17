import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type BloqueDocument = HydratedDocument<Bloque>;

@Schema({
  collection: 'bloques',
  timestamps: true,
  versionKey: false,
})
export class Bloque {
  @Prop({ type: Types.ObjectId, ref: 'Torneo', required: true })
  torneo: Types.ObjectId;

  /** "Bloque A", "Bloque B", ... */
  @Prop({ required: true, trim: true })
  nombre: string;

  @Prop({ type: [Types.ObjectId], ref: 'Robot', default: [] })
  robots: Types.ObjectId[];
}

export const BloqueSchema = SchemaFactory.createForClass(Bloque);
BloqueSchema.index({ torneo: 1, nombre: 1 }, { unique: true });
