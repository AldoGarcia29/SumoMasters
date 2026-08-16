import { IsArray, IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { FaseCombate } from '../enums/combate.enums';

export class GenerarCombatesDto {
  /** Si se omite, genera para todos los bloques del torneo. */
  @IsOptional()
  @IsMongoId()
  bloqueId?: string;

  /**
   * Lista explícita de IDs de bloque a usar. Si el frontend ya tiene los
   * bloques cargados (p. ej. porque acaba de generarlos), puede mandarlos
   * aquí directamente en vez de depender de que el backend los vuelva a
   * buscar por torneoId.
   */
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  bloqueIds?: string[];

  @IsOptional()
  @IsEnum(FaseCombate)
  fase?: FaseCombate;
}
