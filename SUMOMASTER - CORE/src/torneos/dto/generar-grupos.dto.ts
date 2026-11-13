import { IsInt, Min } from 'class-validator';

export class GenerarGruposDto {
  @IsInt({ message: 'La cantidad de grupos debe ser un número entero' })
  @Min(1, { message: 'Debe haber al menos un grupo' })
  cantidadGrupos!: number;
}