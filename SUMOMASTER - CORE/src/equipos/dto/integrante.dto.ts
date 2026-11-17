import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class IntegranteDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del integrante es obligatorio' })
  @MaxLength(100)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  rol?: string;
}
