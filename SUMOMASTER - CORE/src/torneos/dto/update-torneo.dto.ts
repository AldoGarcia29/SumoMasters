import { PartialType } from '@nestjs/mapped-types';
import { CreateTorneoDto } from './create-torneo.dto';

export class UpdateTorneoDto extends PartialType(CreateTorneoDto) {}
