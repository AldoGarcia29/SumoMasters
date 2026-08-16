import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class GenerarBloquesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  tamanioBloque?: number;

  @IsOptional()
  @IsIn(['aleatorio', 'aleatorio-balanceado'])
  metodoDistribucion?: 'aleatorio' | 'aleatorio-balanceado';

  @IsOptional()
  @IsBoolean()
  balancearPorRanking?: boolean;
}
