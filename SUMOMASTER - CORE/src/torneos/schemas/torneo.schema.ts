import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { EstadoTorneo } from '../enums/estado-torneo.enum';
import type { GrupoRoboSoccer } from '../robo-soccer/generar-grupos';
import type {
  CruceInicialManual,
  DecisionesLlave,
  RondaInicial,
} from '../robo-soccer/llaves-robo-soccer';

export type TorneoDocument = HydratedDocument<Torneo>;

@Schema({ _id: false })
export class ParticipanteTorneo {

  @Prop({ type: Object, default: null })
llaveRoboSoccer?: {
  rondaInicial: RondaInicial;
  crucesIniciales: CruceInicialManual[];
  decisiones: DecisionesLlave;
} | null;

  @Prop({ type: Types.ObjectId, ref: 'Robot', required: true })
  robot: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1 })
  numero: number;
}

export const ParticipanteTorneoSchema =
  SchemaFactory.createForClass(ParticipanteTorneo);

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

    /** Equipos inscritos en el torneo de Robo Soccer RC. */
  @Prop({ type: [Types.ObjectId], ref: 'Equipo', default: [] })
  equiposInscritos: Types.ObjectId[];

  @Prop({ type: [Object], default: [] })
gruposRoboSoccer: GrupoRoboSoccer[];

  @Prop({ type: Object, default: null })
  llaveRoboSoccer?: {
    rondaInicial: RondaInicial;
    crucesIniciales: CruceInicialManual[];
    decisiones: DecisionesLlave;
  } | null;

  @Prop({ type: [ParticipanteTorneoSchema], default: [] })
  participantes: ParticipanteTorneo[];

  @Prop({ type: Number, default: 0, min: 0 })
  ultimoNumero: number;

  /** Tamaño de bloque usado en la fase de grupos (por defecto 16). */
  @Prop({ default: 16, min: 2 })
  tamanioBloque: number;

  @Prop({ type: Date, default: null })
  horaInicio?: Date | null;

  @Prop({ type: Number, default: 15, min: 1, max: 120 })
  duracionCombateMin: number;

  @Prop({ type: Boolean, default: true, index: true })
  publico: boolean;

    @Prop({ type: Types.ObjectId, ref: 'Combate', default: null })
  combateProyectado: Types.ObjectId | null;
}

export const TorneoSchema = SchemaFactory.createForClass(Torneo);
