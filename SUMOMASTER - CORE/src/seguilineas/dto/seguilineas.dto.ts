import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsDateString, IsInt, IsMongoId, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateSeguilineasDto {
  @IsString() @IsNotEmpty() nombre: string;
  @IsDateString() fecha: string;
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsMongoId({ each: true }) staffIds?: string[];
}
export class AsignarStaffSeguilineasDto {
  @IsArray() @ArrayUnique() @IsMongoId({ each: true }) staffIds: string[];
}
export class InscribirRobotSeguilineasDto {
  @IsMongoId() robotId: string;
}
export class RegistrarTiempoDto {
  @IsMongoId() robotId: string;
  /** Tiempo en milisegundos (máx. 1 h). */
  @Type(() => Number) @IsInt() @Min(1) @Max(3_600_000) tiempoMs: number;
}
