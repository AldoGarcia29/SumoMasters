import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { EstadoRobot } from '../enums/estado-robot.enum';

export class CreateRobotDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del robot es obligatorio' })
  @MaxLength(80)
  nombre: string;

  @IsMongoId({ message: 'Selecciona un equipo válido' })
  equipo: string;

  @IsMongoId({ message: 'Selecciona una categoría válida' })
  categoria: string;

  @IsOptional()
  @IsNumber({}, { message: 'El peso debe ser numérico' })
  @Min(0)
  pesoKg?: number | null;

  @IsOptional()
  @IsEnum(EstadoRobot, { message: 'Estado no válido' })
  estado?: EstadoRobot;

  @IsOptional()
  @IsString()
  imagenUrl?: string;
}
