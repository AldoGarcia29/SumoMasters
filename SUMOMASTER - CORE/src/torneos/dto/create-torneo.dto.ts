import {
  IsArray,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { EstadoTorneo } from '../enums/estado-torneo.enum';

export class CreateTorneoDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del torneo es obligatorio' })
  @MaxLength(120)
  nombre: string;

  @IsDateString({}, { message: 'La fecha no es válida' })
  fecha: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsMongoId({ message: 'Selecciona una categoría válida' })
  categoria: string;

  @IsOptional()
  @IsEnum(EstadoTorneo, { message: 'Estado no válido' })
  estado?: EstadoTorneo;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true, message: 'Uno de los robots seleccionados no es válido' })
  robotsInscritos?: string[];

  @IsOptional()
  @Min(2)
  tamanioBloque?: number;
}
