import { IsBoolean } from 'class-validator';

export class UpdateVisibilidadDto {
  @IsBoolean()
  publico: boolean;
}
