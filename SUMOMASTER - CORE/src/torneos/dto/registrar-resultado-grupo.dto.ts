import { IsDefined, IsInt, IsMongoId, Min } from 'class-validator';

export class RegistrarResultadoGrupoDto {
  @IsMongoId()
  localId!: string;

  @IsMongoId()
  visitanteId!: string;

  @IsDefined()
  @IsInt()
  @Min(0)
  golesLocal!: number;

  @IsDefined()
  @IsInt()
  @Min(0)
  golesVisitante!: number;
}