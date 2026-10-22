import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
export type AsignacionDojoDocument = HydratedDocument<AsignacionDojo>;
@Schema({ collection: 'asignaciones_dojos', timestamps: true })
export class AsignacionDojo {
  @Prop({ type: Types.ObjectId, required: true, index: true }) staffId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, required: true, index: true }) torneoId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, required: true }) dojoId: Types.ObjectId;
  @Prop({ required: true, match: /^\d{4}-\d{2}-\d{2}$/ }) fecha: string;
}
export const AsignacionDojoSchema = SchemaFactory.createForClass(AsignacionDojo);
AsignacionDojoSchema.index({ staffId: 1, torneoId: 1, fecha: 1, dojoId: 1 }, { unique: true });
