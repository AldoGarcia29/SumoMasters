import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';
import { EstadoRobot } from '../schemas/robot.schema';

export class CreateRobotDto {
  @IsString()
  @IsNotEmpty()
  nombreRobot!: string;

  @IsMongoId()
  equipoId!: string;

  @IsMongoId()
  categoriaId!: string;

  @IsNumber()
  @Min(0)
  peso!: number;

  @IsNumber()
  @Min(0)
  fuerza!: number;

  @IsOptional()
  @IsEnum(EstadoRobot)
  estado?: EstadoRobot;

  @IsOptional()
  @IsUrl()
  imagenUrl?: string;
}