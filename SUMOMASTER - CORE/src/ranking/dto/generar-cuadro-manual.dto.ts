import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsMongoId,
  ValidateNested,
} from 'class-validator';
import { FaseCombate } from '../../combates/enums/combate.enums';

export class CruceManualDto {
  @IsMongoId()
  robot1Id!: string;

  @IsMongoId()
  robot2Id!: string;
}

export class GenerarCuadroManualDto {
  @IsIn([
    FaseCombate.DIECISEISAVOS,
    FaseCombate.OCTAVOS,
    FaseCombate.CUARTOS,
    FaseCombate.SEMIFINAL,
  ])
  faseInicial!: FaseCombate;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CruceManualDto)
  cruces!: CruceManualDto[];
}