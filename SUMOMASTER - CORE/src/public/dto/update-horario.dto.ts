import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateHorarioDto {
  /** ISO 8601, ej: "2026-11-07T09:00:00-06:00". Manda null para borrarla. */
  @IsOptional()
  @IsDateString()
  horaInicio?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  duracionCombateMin?: number;
}
