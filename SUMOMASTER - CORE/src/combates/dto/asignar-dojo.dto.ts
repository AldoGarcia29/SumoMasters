import { IsMongoId } from 'class-validator';

export class AsignarDojoDto {
  @IsMongoId({ message: 'Selecciona un dojo válido' })
  dojo: string;
}
