import {
  IsDefined,
  IsISO8601,
  Matches,
  ValidateIf,
} from 'class-validator';

export class ActualizarHorarioCombateDto {
  // null permite quitar el horario.
  @IsDefined()
  @ValidateIf((_objeto, valor) => valor !== null)
  @IsISO8601({ strict: true })
  @Matches(
    /T.*(?:Z|[+-]\d{2}:\d{2})$/,
    {
      message:
        'El horario debe incluir zona horaria, por ejemplo: 2026-10-22T13:00:00-06:00.',
    },
  )
  horarioProgramado!: string | null;
}