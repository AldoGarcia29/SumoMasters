import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
} from 'class-validator';

import {
  EstadoCategoria,
  TipoCombate,
} from '../schemas/categoria.schema';

export class CreateCategoriaDto {
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsString()
  @IsNotEmpty()
  descripcion!: string;

  @IsNumber()
  @Min(0)
  pesoMaximo!: number;

  @IsEnum(TipoCombate)
  tipoCombate!: TipoCombate;

  @IsString()
  @IsNotEmpty()
  reglas!: string;

  @IsEnum(EstadoCategoria)
  estado!: EstadoCategoria;
}