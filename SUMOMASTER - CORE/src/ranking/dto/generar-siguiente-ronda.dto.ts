import { IsEnum } from 'class-validator';
import { FaseCombate } from '../../combates/enums/combate.enums';

export class GenerarSiguienteRondaDto {
  @IsEnum(FaseCombate, {
    message: 'La fase actual no es válida',
  })
  faseActual!: FaseCombate;
}