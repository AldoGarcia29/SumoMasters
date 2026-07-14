import {
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class CreateEquipoDto {
  @IsString()
  @IsNotEmpty()
  nombreEquipo!: string;

  @IsString()
  @IsNotEmpty()
  institucion!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  integrantes!: string[];

  @IsMongoId()
  categoriaId!: string;

  @IsMongoId()
  torneoId!: string;
}