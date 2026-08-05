import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { FaseCombate } from '../enums/combate.enums';

export class GenerarCombatesDto {
  /** Si se omite, genera para todos los bloques del torneo. */
  @IsOptional()
  @IsMongoId()
  bloqueId?: string;

  @IsOptional()
  @IsEnum(FaseCombate)
  fase?: FaseCombate;
}
