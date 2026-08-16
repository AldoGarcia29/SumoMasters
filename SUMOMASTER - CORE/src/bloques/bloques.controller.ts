import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { Public } from '../common/decorators/public.decorator';
import { Role } from '../common/enums/role.enum';
import { Roles } from '../common/decorators/roles.decorator';
import { BloquesService } from './bloques.service';
import { GenerarBloquesDto } from './dto/generar-bloques.dto';

@Controller('torneos/:torneoId/bloques')
export class BloquesController {
  constructor(
    private readonly bloquesService: BloquesService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  @Get()
  findAll(@Param('torneoId') torneoId: string) {
    return this.bloquesService.findByTorneo(torneoId);
  }

  /**
   * Endpoint de DIAGNÓSTICO temporal — sin autenticación, para poder abrirlo
   * directamente en el navegador y confirmar qué ve el servidor realmente
   * corriendo, sin pasar por el frontend ni por el login. Bórralo cuando ya
   * no lo necesites.
   * Ejemplo: http://localhost:8082/api/torneos/<ID_DEL_TORNEO>/bloques/debug
   */
  @Public()
  @Get('debug')
  async debug(@Param('torneoId') torneoId: string) {
    // 1) Vía Mongoose (Model.find) — lo que usan los servicios normalmente.
    const viaMongoose = await this.bloquesService.findByTorneo(torneoId);

    // 2) Vía driver nativo de MongoDB, sin Mongoose de por medio — para
    // descartar que el problema esté en el casting/model de Mongoose.
    const db = this.connection.db;
    if (!db) {
      return {
        torneoIdRecibido: torneoId,
        error: 'No hay conexión activa a la base de datos (connection.db es undefined).',
        viaMongoose: { total: viaMongoose.length, items: viaMongoose },
      };
    }

    let viaDriverNativo: unknown[] = [];
    let errorDriverNativo: string | null = null;
    try {
      viaDriverNativo = await db
        .collection('bloques')
        .find({ torneo: new Types.ObjectId(torneoId) })
        .toArray();
    } catch (e: unknown) {
      errorDriverNativo = e instanceof Error ? e.message : String(e);
    }

    // 3) Todos los bloques que existen en la colección, sin filtrar por
    // torneo — para ver si el torneoId realmente coincide con lo guardado.
    const todosLosBloques = await db
      .collection('bloques')
      .find({})
      .project({ torneo: 1, nombre: 1 })
      .toArray();

    return {
      torneoIdRecibido: torneoId,
      baseDeDatos: db.databaseName,
      viaMongoose: { total: viaMongoose.length, items: viaMongoose },
      viaDriverNativo: { total: viaDriverNativo.length, items: viaDriverNativo, error: errorDriverNativo },
      todosLosBloquesEnLaColeccion: todosLosBloques.map((b: any) => ({
        id: b._id.toString(),
        torneo: b.torneo?.toString(),
        nombre: b.nombre,
        coincideConTorneoId: b.torneo?.toString() === torneoId,
      })),
    };
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Post('generar')
  generar(@Param('torneoId') torneoId: string, @Body() dto: GenerarBloquesDto) {
    return this.bloquesService.generar(torneoId, dto);
  }
}
