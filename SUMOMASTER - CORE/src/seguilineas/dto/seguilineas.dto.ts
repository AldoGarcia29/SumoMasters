import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { EstadoTorneo } from '../../torneos/enums/estado-torneo.enum';
import { EstadoRegistro, EstadoTurno } from '../enums/seguilineas.enums';

export class CreateSeguilineasDto {
  @IsString() @IsNotEmpty() nombre: string;
  @IsDateString() fecha: string;
  @IsOptional() @IsString() descripcion?: string;
  /** Opcional: si se omite se usa la categoría de tipo Seguilineas. */
  @IsOptional() @IsMongoId() categoriaId?: string;
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  staffIds?: string[];
}
export class UpdateSeguilineasDto {
  @IsOptional() @IsString() @IsNotEmpty() nombre?: string;
  @IsOptional() @IsDateString() fecha?: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsEnum(EstadoTorneo) estado?: EstadoTorneo;
}
export class AsignarStaffSeguilineasDto {
  @IsArray() @ArrayUnique() @IsMongoId({ each: true }) staffIds: string[];
}
export class InscribirRobotSeguilineasDto {
  @IsMongoId() robotId: string;
}
export class RegistrarTiempoDto {
  @IsMongoId() robotId: string;
  @IsOptional() @IsEnum(EstadoRegistro) estado?: EstadoRegistro;
  /** Obligatorio solo si estado es VALIDO (default). */
  @ValidateIf((o: RegistrarTiempoDto) => !o.estado || o.estado === EstadoRegistro.VALIDO)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3_600_000)
  tiempoMs?: number;
}
export class EditarRegistroDto {
  @IsOptional() @IsEnum(EstadoRegistro) estado?: EstadoRegistro;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3_600_000)
  tiempoMs?: number;
}
export class ReordenarColaDto {
  @IsArray() @ArrayUnique() @IsMongoId({ each: true }) robotIds: string[];
}
export class CambiarTurnoDto {
  @IsEnum(EstadoTurno) estadoTurno: EstadoTurno;
}
export class OrdenPodioDto {
  @IsArray() @ArrayUnique() @IsMongoId({ each: true }) robotIds: string[];
}
export class FinalizarSeguilineasDto {
  /** Orden manual opcional entre robots empatados. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  robotIds?: string[];
}
