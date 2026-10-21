import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class GenerarBloquesDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidadBloques: number;
}