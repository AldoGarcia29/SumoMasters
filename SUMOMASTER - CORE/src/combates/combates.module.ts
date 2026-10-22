import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Bloque, BloqueSchema } from '../bloques/schemas/bloque.schema';
import { Dojo, DojoSchema } from '../dojos/schemas/dojo.schema';
import { Combate, CombateSchema } from './schemas/combate.schema';
import { CombatesController } from './combates.controller';
import { CombatesService } from './combates.service';
import { AsignacionesStaffService } from './asignaciones-staff.service';
import { AsignacionStaff, AsignacionStaffSchema } from './schemas/asignacion-staff.schema';
import { User, UserSchema } from '../common/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Combate.name, schema: CombateSchema },
      { name: Bloque.name, schema: BloqueSchema },
      { name: Dojo.name, schema: DojoSchema },
      { name: User.name, schema: UserSchema },
      { name: AsignacionStaff.name, schema: AsignacionStaffSchema },
    ]),
  ],
  controllers: [CombatesController],
  providers: [CombatesService, AsignacionesStaffService],
  exports: [CombatesService],
})
export class CombatesModule {}
