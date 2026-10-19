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

@Controller()
export class VersusController {
  constructor(
    @InjectModel(Torneo.name)
    private readonly torneos: Model<TorneoDocument>,

    @InjectModel(Combate.name)
    private readonly combates: Model<CombateDocument>,
  ) {}

  private validarId(id: unknown): asserts id is string {
    if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) {
      throw new BadRequestException('Identificador inválido.');
    }
  }

  // Solo el personal autorizado puede cambiar la proyección.
  @Roles(Role.ADMIN, Role.STAFF)
  @Patch('torneos/:id/proyeccion')
  async seleccionar(
    @Param('id') id: string,
    @Body('combateId') combateId: unknown,
  ) {
    this.validarId(id);

    if (combateId !== null) {
      this.validarId(combateId);

      const combate = await this.combates.exists({
        _id: combateId,
        torneo: id,
        dojo: { $ne: null },
      });

      if (!combate) {
        throw new BadRequestException(
          'El combate debe pertenecer al torneo y tener dojo asignado.',
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
          .findOne({
            _id: torneo.combateProyectado,
            torneo: id,
          })
          .select(
            'numero fase bloque dojo arena turno estado resultado robot1 robot2',
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

    return {
      torneo: {
        id: String(torneo._id),
        nombre: torneo.nombre,
      },
      combate,
    };
  }
}