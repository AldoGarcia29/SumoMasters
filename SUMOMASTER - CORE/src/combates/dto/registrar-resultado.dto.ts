import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { MetodoVictoria, ResultadoCombate } from '../enums/combate.enums';

export class RegistrarResultadoDto {
  @IsEnum(ResultadoCombate, { message: 'Resultado no válido' })
  resultado: ResultadoCombate;

  @IsOptional()
  @IsEnum(MetodoVictoria, { message: 'Método de victoria no válido' })
  metodoVictoria?: MetodoVictoria;

  @IsOptional()
  @IsInt()
  @Min(0)
  duracionSegundos?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  jueces?: string[];

  @IsOptional()
  @IsString()
  observaciones?: string;
}
