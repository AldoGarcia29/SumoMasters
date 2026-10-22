import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  ValidateIf,
  IsString,
  Min,
} from 'class-validator';
import { MetodoVictoria, ResultadoCombate } from '../enums/combate.enums';

export class RegistrarResultadoDto {
  @IsEnum(ResultadoCombate, { message: 'Resultado no válido' })
  resultado: ResultadoCombate;

  @IsEnum(MetodoVictoria, { message: 'Selecciona un método de victoria válido' })
  metodoVictoria: MetodoVictoria;

  @ValidateIf((dto) => dto.metodoVictoria === MetodoVictoria.OTRO)
  @IsString()
  @IsNotEmpty({ message: 'Especifica el otro método de victoria' })
  @MaxLength(150)
  otroMetodoVictoria?: string;

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
