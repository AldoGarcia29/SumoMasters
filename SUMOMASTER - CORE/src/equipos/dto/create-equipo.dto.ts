import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { IntegranteDto } from './integrante.dto';

export class CreateEquipoDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del equipo es obligatorio' })
  @MaxLength(100)
  nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'La institución es obligatoria' })
  @MaxLength(120)
  institucion: string;

  @IsMongoId({ message: 'Selecciona una categoría válida' })
  categoria: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Agrega al menos un integrante' })
  @ValidateNested({ each: true })
  @Type(() => IntegranteDto)
  integrantes: IntegranteDto[];

  @IsOptional()
  @IsString()
  logoIniciales?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;
}
