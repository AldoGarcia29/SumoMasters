import { PartialType } from '@nestjs/mapped-types';
import { CreateDojoDto } from './create-dojo.dto';

export class UpdateDojoDto extends PartialType(CreateDojoDto) {}
