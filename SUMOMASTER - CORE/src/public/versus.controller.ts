import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import {
  Torneo,
  TorneoDocument,
} from '../torneos/schemas/torneo.schema';
import {
  Combate,
  CombateDocument,
} from '../combates/schemas/combate.schema';
import { EstadoCombate } from '../combates/enums/combate.enums';



import {
  Proyeccion,
  ProyeccionDocument,
} from './schemas/proyeccion.schema';

@Controller()
export class VersusController {
  constructor(
    @InjectModel(Torneo.name)
    private readonly torneos: Model<TorneoDocument>,

    @InjectModel(Combate.name)
    private readonly combates: Model<CombateDocument>,

    @InjectModel(Proyeccion.name)
  private readonly proyecciones: Model<ProyeccionDocument>,
  ) {}

  private validarId(id: unknown): asserts id is string {
    if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
      throw new BadRequestException('Identificador inválido.');
    }
  }

  // Solo el personal autorizado puede cambiar la proyección.
  @Roles(Role.ADMIN)
  @Patch('torneos/:id/proyeccion')
  async seleccionar(
    @Param('id') id: string,
    @Body('combateId') combateId: unknown,
  ) {
    this.validarId(id);

    if (combateId !== null) {
      this.validarId(combateId);

      const combate = await this.combates
  .findById(combateId)
  .select('torneo dojo')
  .lean();

if (!combate) {
  throw new NotFoundException(
    'El combate seleccionado ya no existe. Actualiza la lista.',
  );
}

if (String(combate.torneo) !== id) {
  throw new BadRequestException(
    'El combate seleccionado pertenece a otro torneo.',
  );
}

if (!combate.dojo) {
  throw new BadRequestException(
    'El combate seleccionado no tiene dojo asignado. Guarda la asignación de dojos y actualiza la lista.',
  );
}
    }

    const torneo = await this.torneos.findByIdAndUpdate(
      id,
      { $set: { combateProyectado: combateId } },
      { new: true, runValidators: true },
    );

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado.');
    }

    return { combateId: torneo.combateProyectado };
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Patch('torneos/:id/pantallas')
  async actualizarPantallas(
    @Param('id') id: string,
    @Body() body: { dojosActivos?: unknown; combateProyectado?: unknown },
  ) {
    this.validarId(id);
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('El cuerpo de la solicitud no es válido.');
    }

    const actualizacion: Record<string, unknown> = {};
    if (body.dojosActivos !== undefined) {
      if (
        !Number.isInteger(body.dojosActivos) ||
        Number(body.dojosActivos) < 1 ||
        Number(body.dojosActivos) > 8
      ) {
        throw new BadRequestException(
          'Dojos activos debe ser un número entero entre 1 y 8.',
        );
      }
      actualizacion.dojosActivos = Number(body.dojosActivos);
    }

    if (body.combateProyectado !== undefined) {
      const combateId = body.combateProyectado;
      if (combateId !== null) this.validarId(combateId);

      if (combateId !== null) {
        const combate = await this.combates
          .findById(combateId)
          .select('torneo robot1 robot2')
          .populate('robot1', '_id')
          .populate('robot2', '_id')
          .lean()
          .exec();
        if (!combate) {
          throw new NotFoundException('El combate seleccionado no existe.');
        }
        if (String(combate.torneo).toLowerCase() !== id.toLowerCase()) {
          throw new BadRequestException(
            'El combate seleccionado pertenece a otro torneo.',
          );
        }
        if (!combate.robot1 || !combate.robot2) {
          throw new BadRequestException(
            'El combate debe tener sus dos robots definidos.',
          );
        }
      }
      actualizacion.combateProyectado =
        combateId === null ? null : new Types.ObjectId(String(combateId));
    }

    if (Object.keys(actualizacion).length === 0) {
      throw new BadRequestException('Indica un ajuste de pantallas.');
    }

    const torneo = await this.torneos
      .findByIdAndUpdate(
        id,
        { $set: actualizacion },
        { new: true, runValidators: true },
      )
      .select('dojosActivos combateProyectado')
      .lean()
      .exec();
    if (!torneo) throw new NotFoundException('Torneo no encontrado.');

    return {
      dojosActivos: torneo.dojosActivos,
      combateProyectado: torneo.combateProyectado
        ? String(torneo.combateProyectado)
        : null,
    };
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Get('torneos/:id/pantallas')
  @Header('Cache-Control', 'no-store')
  async pantallasAdministrativas(@Param('id') id: string) {
    this.validarId(id);
    return this.armarPantallas(id, false);
  }

  @Public()
  @Get('public/torneos/:id/pantallas')
  @Header('Cache-Control', 'no-store')
  async pantallasPublicas(@Param('id') id: string) {
    this.validarId(id);
    return this.armarPantallas(id, true);
  }

  private async armarPantallas(id: string, soloPublicos: boolean) {
    const torneo = await this.torneos
      .findOne({ _id: id, ...(soloPublicos ? { publico: true } : {}) })
      .select('nombre participantes dojosActivos combateProyectado')
      .lean()
      .exec();
    if (!torneo) {
      throw new NotFoundException('Torneo no disponible al público.');
    }

    const combates = (
      await this.combates
      .find({
        torneo: new Types.ObjectId(id),
        estado: {
          $in: [EstadoCombate.EN_CURSO, EstadoCombate.PENDIENTE],
        },
        robot1: { $ne: null },
        robot2: { $ne: null },
      })
      .select(
        'numero fase ronda bloque dojo arena turno estado robot1 robot2',
      )
      .populate('bloque', 'nombre')
      .populate('dojo', 'nombre')
      .populate('robot1', 'nombre imagenUrl')
      .populate('robot2', 'nombre imagenUrl')
      .lean()
      .exec()
    ).filter((combate) => combate.robot1 && combate.robot2);

    const ordenFases = [
      'Fase de grupos',
      'Ronda preliminar',
      'Dieciseisavos de final',
      'Octavos de final',
      'Cuartos de final',
      'Semifinal',
      'Tercer lugar',
      'Final',
    ];
    const sinOrden = Number.MAX_SAFE_INTEGER;
    combates.sort(
      (a, b) =>
        (ordenFases.indexOf(String(a.fase)) < 0
          ? sinOrden
          : ordenFases.indexOf(String(a.fase))) -
          (ordenFases.indexOf(String(b.fase)) < 0
            ? sinOrden
            : ordenFases.indexOf(String(b.fase))) ||
        (a.ronda ?? sinOrden) - (b.ronda ?? sinOrden) ||
        (a.turno ?? sinOrden) - (b.turno ?? sinOrden) ||
        String((a.dojo as any)?.nombre ?? '').localeCompare(
          String((b.dojo as any)?.nombre ?? ''),
          'es',
          { numeric: true },
        ) ||
        (a.arena ?? sinOrden) - (b.arena ?? sinOrden),
    );

    const numeroPorRobot = new Map(
      (torneo.participantes ?? []).map((p: any) => [
        String(p.robot),
        p.numero,
      ]),
    );
    const dojosAsignados = await this.combates.distinct('dojo', {
      torneo: new Types.ObjectId(id),
      dojo: { $ne: null },
    });
    const dojosDisponibles = Math.max(
      1,
      Math.min(8, dojosAsignados.length),
    );
    const dojosActivos = Math.max(
      1,
      Math.min(8, torneo.dojosActivos ?? dojosDisponibles),
    );
    if (torneo.dojosActivos == null && dojosAsignados.length > 0) {
      await this.torneos
        .updateOne(
          { _id: id, dojosActivos: { $exists: false } },
          { $set: { dojosActivos } },
        )
        .exec();
    }

    const mapearCombate = (combate: (typeof combates)[number]) => ({
      id: String(combate._id),
      numero: combate.numero,
      fase: combate.fase,
      bloque:
        combate.bloque && typeof combate.bloque === 'object'
          ? (combate.bloque as any).nombre
          : null,
      dojo:
        combate.dojo && typeof combate.dojo === 'object'
          ? (combate.dojo as any).nombre
          : null,
      arena: combate.arena ?? null,
      turno: combate.turno ?? null,
      estado: combate.estado,
      robot1: {
        nombre: (combate.robot1 as any).nombre,
        numero:
          numeroPorRobot.get(String((combate.robot1 as any)._id)) ?? null,
        imagenUrl: (combate.robot1 as any).imagenUrl ?? null,
      },
      robot2: {
        nombre: (combate.robot2 as any).nombre,
        numero:
          numeroPorRobot.get(String((combate.robot2 as any)._id)) ?? null,
        imagenUrl: (combate.robot2 as any).imagenUrl ?? null,
      },
      esPrincipal:
        String(torneo.combateProyectado ?? '') === String(combate._id),
    });
    const lote = combates.slice(0, dojosActivos).map(mapearCombate);
    const despues = combates
      .slice(dojosActivos, dojosActivos + 6)
      .map(mapearCombate);

    return {
      torneo: { id: String(torneo._id), nombre: torneo.nombre },
      dojosActivos,
      dojosDisponibles,
      combateProyectado: torneo.combateProyectado
        ? String(torneo.combateProyectado)
        : null,
      lote,
      despues,
    };
  }

  // Consulta administrativa del combate actualmente seleccionado.
  @Roles(Role.ADMIN, Role.STAFF)
  @Get('torneos/:id/proyeccion')
  @Header('Cache-Control', 'no-store')
  async seleccionActual(@Param('id') id: string) {
    this.validarId(id);

    const torneo = await this.torneos
      .findById(id)
      .select('combateProyectado publico')
      .lean();

    if (!torneo) {
      throw new NotFoundException('Torneo no encontrado.');
    }

    return {
      combateId: torneo.combateProyectado
        ? String(torneo.combateProyectado)
        : null,
      publico: torneo.publico,
    };
  }

  @Public()
  @Get('public/torneos/:id/versus')
  @Header('Cache-Control', 'no-store')
  async publico(@Param('id') id: string) {
    this.validarId(id);

    const torneo = await this.torneos
      .findOne({ _id: id, publico: true })
      .select('nombre combateProyectado')
      .lean();

    if (!torneo) {
      throw new NotFoundException('Torneo no disponible al público.');
    }

    // Lista explícita de campos que puede consultar el público.
    const combate = torneo.combateProyectado
      ? await this.combates
          .findById(torneo.combateProyectado)
          .select(
  'torneo numero fase bloque dojo arena turno estado resultado robot1 robot2',
)
          .populate('bloque', 'nombre')
          .populate('dojo', 'nombre')
          .populate({
            path: 'robot1',
            select: 'nombre imagenUrl equipo',
            populate: { path: 'equipo', select: 'nombre' },
          })
          .populate({
            path: 'robot2',
            select: 'nombre imagenUrl equipo',
            populate: { path: 'equipo', select: 'nombre' },
          })
          .lean()
      : null;

      if (
  combate &&
  String(combate.torneo).toLowerCase() !== id.toLowerCase()
) {
  throw new BadRequestException(
    'El combate proyectado no pertenece a este torneo.',
  );
}

    return {
      torneo: {
        id: String(torneo._id),
        nombre: torneo.nombre,
      },
      combate,
    };
  }


  @Roles(Role.ADMIN, Role.STAFF)
@Get('proyeccion/principal')
@Header('Cache-Control', 'no-store')
async seleccionPrincipal() {
  const seleccion = await this.proyecciones
    .findById('principal')
    .lean()
    .exec();

  return {
    torneoId: seleccion ? String(seleccion.torneo) : null,
    combateId: seleccion?.combate
      ? String(seleccion.combate)
      : null,
  };
}

@Roles(Role.ADMIN)
@Patch('proyeccion/principal')
async seleccionarPrincipal(
  @Body('torneoId') torneoId: unknown,
  @Body('combateId') combateId: unknown,
) {
  this.validarId(torneoId);

  const torneo = await this.torneos
    .findById(torneoId)
    .select('_id publico')
    .lean()
    .exec();

  if (!torneo) {
    throw new NotFoundException('Torneo no encontrado.');
  }

  if (!torneo.publico) {
    throw new BadRequestException(
      'Activa la visibilidad pública del torneo antes de proyectarlo.',
    );
  }

  let combateSeleccionado: Types.ObjectId | null = null;

  if (combateId !== null) {
    this.validarId(combateId);

    const combate = await this.combates
      .findById(combateId)
      .select('torneo dojo robot1 robot2')
      .lean()
      .exec();

    if (!combate) {
      throw new NotFoundException(
        'El combate ya no existe. Actualiza la lista.',
      );
    }

    if (
      String(combate.torneo).toLowerCase() !==
      torneoId.toLowerCase()
    ) {
      throw new BadRequestException(
        'El combate pertenece a otro torneo.',
      );
    }

    if (!combate.dojo) {
      throw new BadRequestException(
        'Asigna un dojo al combate antes de proyectarlo.',
      );
    }

    if (!combate.robot1 || !combate.robot2) {
      throw new BadRequestException(
        'El combate debe tener sus dos robots definidos.',
      );
    }

    combateSeleccionado = new Types.ObjectId(combateId);
  }

  // Torneo y combate cambian juntos en un solo documento.
  await this.proyecciones
    .findByIdAndUpdate(
      'principal',
      {
        $set: {
          torneo: new Types.ObjectId(torneoId),
          combate: combateSeleccionado,
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
      },
    )
    .exec();

  return {
    torneoId,
    combateId: combateSeleccionado
      ? String(combateSeleccionado)
      : null,
  };
}

@Public()
@Get('public/versus/principal')
@Header('Cache-Control', 'no-store')
async publicoPrincipal(@Query('torneo') torneoId?: string) {
  if (torneoId) {
    this.validarId(torneoId);
    const pantallas = await this.pantallasPublicas(torneoId);
    const combate = pantallas.combateProyectado
      ? await this.combates
          .findOne({
            _id: pantallas.combateProyectado,
            torneo: new Types.ObjectId(torneoId),
          })
          .select(
            'torneo numero fase ronda horarioProgramado bloque dojo arena turno estado resultado robot1 robot2',
          )
          .populate('bloque', 'nombre')
          .populate('dojo', 'nombre')
          .populate('robot1', 'nombre imagenUrl')
          .populate('robot2', 'nombre imagenUrl')
          .lean()
          .exec()
      : null;

    return {
      torneo: pantallas.torneo,
      combate,
      dojosActivos: pantallas.dojosActivos,
      lote: pantallas.lote,
    };
  }

  const seleccion = await this.proyecciones
    .findById('principal')
    .lean()
    .exec();

  if (!seleccion) {
    return null;
  }

  const torneo = await this.torneos
    .findOne({
      _id: seleccion.torneo,
      publico: true,
    })
    .select('nombre')
    .lean()
    .exec();

  // Si se elimina o se vuelve privado, deja de publicarse.
  if (!torneo) {
    return null;
  }

  const combate = seleccion.combate
    ? await this.combates
        .findOne({
          _id: seleccion.combate,
          torneo: torneo._id,
        })
        .select(
          'torneo numero fase ronda horarioProgramado bloque dojo arena turno estado resultado robot1 robot2',
        )
        .populate('bloque', 'nombre')
        .populate('dojo', 'nombre')
        .populate({
          path: 'robot1',
          select: 'nombre imagenUrl',
        })
        .populate({
          path: 'robot2',
          select: 'nombre imagenUrl',
        })
        .lean()
        .exec()
    : null;

  return {
    torneo: {
      id: String(torneo._id),
      nombre: torneo.nombre,
    },
    combate,
  };
}
}