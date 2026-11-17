import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { EstadoDojo } from '../enums/estado-dojo.enum';

export class CreateDojoDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del dojo es obligatorio' })
  nombre: string;

  @IsOptional()
  @IsEnum(EstadoDojo, { message: 'Estado no válido' })
  estado?: EstadoDojo;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacidad?: number;
}
