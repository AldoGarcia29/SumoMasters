import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Patch,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

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

import { Types } from 'mongoose';

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
async publicoPrincipal() {
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