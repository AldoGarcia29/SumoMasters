import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsIn,
  IsMongoId,
  IsObject,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { CAPACIDAD_RONDA } from '../robo-soccer/llaves-robo-soccer';
import type { RondaInicial } from '../robo-soccer/llaves-robo-soccer';

export class CruceInicialManualDto {
  @ValidateIf((_cruce, valor) => valor !== null)
  @IsDefined()
  @IsMongoId()
  localId!: string | null;

  @ValidateIf((_cruce, valor) => valor !== null)
  @IsDefined()
  @IsMongoId()
  visitanteId!: string | null;
}

export class GuardarLlaveRoboSoccerDto {
  @IsIn(Object.keys(CAPACIDAD_RONDA))
  rondaInicial!: RondaInicial;

  @IsArray()
  @ArrayMaxSize(16)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => CruceInicialManualDto)
  crucesIniciales!: CruceInicialManualDto[];
}