import { IsDateString, IsMongoId, Matches } from 'class-validator';
export class CrearAsignacionStaffDto {
  @IsMongoId() usuarioId: string;
  @IsMongoId() torneoId: string;
  @IsMongoId() dojoId: string;
  @Matches(/^\\d{4}-\\d{2}-\\d{2}$/) fecha: string;
}
