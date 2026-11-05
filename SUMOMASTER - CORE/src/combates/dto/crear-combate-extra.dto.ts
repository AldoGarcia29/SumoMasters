import {
  IsISO8601,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CrearCombateExtraDto {
  @IsMongoId({ message: 'Selecciona el robot 1' })
  robot1Id: string;

  @IsMongoId({ message: 'Selecciona el robot 2' })
  robot2Id: string;

  @IsOptional()
  @IsMongoId({ message: 'Selecciona un dojo válido' })
  dojoId?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/, {
    message:
      'El horario debe incluir zona horaria, por ejemplo: 2026-10-22T13:00:00-06:00.',
  })
  horarioProgramado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observaciones?: string;
}
