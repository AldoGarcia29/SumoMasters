import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { EstadoDojo } from '../enums/estado-dojo.enum';

export type DojoDocument = HydratedDocument<Dojo>;

@Schema({
  collection: 'dojos',
  timestamps: true,
  versionKey: false,
})
export class Dojo {
  @Prop({ required: true, unique: true, trim: true })
  nombre: string;

  @Prop({
    type: String,
    enum: EstadoDojo,
    default: EstadoDojo.DISPONIBLE,
  })
  estado: EstadoDojo;

  /** Cantidad máxima de combates que se le pueden asignar en la fase actual. */
  @Prop({ default: 4, min: 1 })
  capacidad: number;
}

export const DojoSchema = SchemaFactory.createForClass(Dojo);
