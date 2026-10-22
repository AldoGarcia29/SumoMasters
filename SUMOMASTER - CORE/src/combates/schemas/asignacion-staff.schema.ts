import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AsignacionStaffDocument = HydratedDocument<AsignacionStaff>;
@Schema({ collection: 'asignaciones_staff', timestamps: true })
export class AsignacionStaff {
  @Prop({ type: Types.ObjectId, required: true, ref: 'User' }) usuario: Types.ObjectId;
  @Prop({ type: Types.ObjectId, required: true, ref: 'Torneo' }) torneo: Types.ObjectId;
  @Prop({ type: Types.ObjectId, required: true, ref: 'Dojo' }) dojo: Types.ObjectId;
  @Prop({ type: String, required: true }) fecha: string; // YYYY-MM-DD, zona America/Mexico_City
}
export const AsignacionStaffSchema = SchemaFactory.createForClass(AsignacionStaff);
AsignacionStaffSchema.index({ usuario: 1, torneo: 1, dojo: 1, fecha: 1 }, { unique: true });
