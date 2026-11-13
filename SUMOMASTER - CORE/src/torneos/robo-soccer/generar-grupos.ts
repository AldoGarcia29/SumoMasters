import { BadRequestException } from '@nestjs/common';

export interface PartidoDeGrupo {
  localId: string;
  visitanteId: string;
  resultado: { golesLocal: number; golesVisitante: number } | null;
}

export interface GrupoRoboSoccer {
  numero: number;
  nombre: string;
  equipoIds: string[];
  partidos: PartidoDeGrupo[];
}

/**
 * Recibe los equipos en el orden del sorteo.
 * El servicio guardará los grupos y los partidos al confirmar.
 */
export function generarGruposRoboSoccer(
  equipoIds: readonly string[],
  cantidadGrupos: number,
): GrupoRoboSoccer[] {
  const ids = equipoIds.map((id) => id.toLowerCase());

  if (new Set(ids).size !== ids.length) {
    throw new BadRequestException('Hay equipos repetidos en el torneo');
  }

  if (ids.length < 2) {
    throw new BadRequestException('Inscríbe al menos dos equipos');
  }

  const maximoGrupos = Math.floor(ids.length / 2);

  if (
    !Number.isInteger(cantidadGrupos) ||
    cantidadGrupos < 1 ||
    cantidadGrupos > maximoGrupos
  ) {
    throw new BadRequestException(
      `Elige entre 1 y ${maximoGrupos} grupos para que cada grupo tenga al menos dos equipos`,
    );
  }

  const grupos: GrupoRoboSoccer[] = Array.from(
    { length: cantidadGrupos },
    (_, indice) => ({
      numero: indice + 1,
      nombre: `Grupo ${indice < 26 ? String.fromCharCode(65 + indice) : indice + 1}`,
      equipoIds: [],
      partidos: [],
    }),
  );

  ids.forEach((id, indice) => {
    grupos[indice % cantidadGrupos].equipoIds.push(id);
  });

  for (const grupo of grupos) {
    const equipos = grupo.equipoIds;

    for (let local = 0; local < equipos.length - 1; local++) {
      for (let visitante = local + 1; visitante < equipos.length; visitante++) {
        grupo.partidos.push({
          localId: equipos[local],
          visitanteId: equipos[visitante],
          resultado: null,
        });
      }
    }
  }

  return grupos;
}