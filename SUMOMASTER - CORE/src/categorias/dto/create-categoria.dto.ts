import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { EstadoCategoria, TipoCombate } from '../enums/categoria.enums';

export class CreateCategoriaDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(80)
  nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @MaxLength(300)
  descripcion: string;

  @IsOptional()
  @IsNumber({}, { message: 'El peso máximo debe ser numérico' })
  @Min(0)
  pesoMaximoKg?: number | null;

  @IsEnum(TipoCombate, { message: 'Tipo de combate no válido' })
  tipoCombate: TipoCombate;

  @IsOptional()
  @IsEnum(EstadoCategoria, { message: 'Estado no válido' })
  estado?: EstadoCategoria;

  @IsOptional()
  @IsString()
  color?: string;
}
