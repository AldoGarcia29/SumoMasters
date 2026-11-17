import { BadRequestException } from '@nestjs/common';

export const CAPACIDAD_RONDA = {
  DIECISEISAVOS: 32,
  OCTAVOS: 16,
  CUARTOS: 8,
  SEMIFINAL: 4,
  FINAL: 2,
} as const;

export type RondaInicial = keyof typeof CAPACIDAD_RONDA;
export type Ronda = RondaInicial | 'TERCER_LUGAR';

export interface CruceLlave {
  id: string;
  ronda: Ronda;
  localId: string | null;
  visitanteId: string | null;
  ganadorId: string | null;
  resuelto: boolean;
}

export interface CruceInicialManual {
  localId: string | null;
  visitanteId: string | null;
}

export interface DecisionLlave {
  localId: string;
  visitanteId: string;
  ganadorId: string;
}

export type DecisionesLlave = Record<string, DecisionLlave>;

const RONDAS: readonly RondaInicial[] = [
  'DIECISEISAVOS',
  'OCTAVOS',
  'CUARTOS',
  'SEMIFINAL',
  'FINAL',
];

function resolverCruce(
  id: string,
  ronda: Ronda,
  localId: string | null,
  visitanteId: string | null,
  decisiones: DecisionesLlave,
): CruceLlave {
  const decision = decisiones[id];

  const ganadorId =
    localId !== null &&
    visitanteId !== null &&
    decision?.localId === localId &&
    decision.visitanteId === visitanteId &&
    (decision.ganadorId === localId || decision.ganadorId === visitanteId)
      ? decision.ganadorId
      : null;

  return {
    id,
    ronda,
    localId,
    visitanteId,
    ganadorId,
    resuelto: ganadorId !== null,
  };
}

function perdedor(cruce: CruceLlave | undefined): string | null {
  if (!cruce?.ganadorId) return null;

  return cruce.ganadorId === cruce.localId
    ? cruce.visitanteId
    : cruce.localId;
}

export function construirLlave(
  equipoIds: readonly string[],
  rondaInicial: RondaInicial,
  crucesIniciales: readonly CruceInicialManual[],
  decisiones: DecisionesLlave = {},
) {
  const inicio = RONDAS.indexOf(rondaInicial);

  if (inicio < 0) {
    throw new BadRequestException('La ronda inicial no es válida.');
  }

  const maximoCruces = CAPACIDAD_RONDA[rondaInicial] / 2;

  if (crucesIniciales.length > maximoCruces) {
    throw new BadRequestException(
      `La ronda seleccionada admite hasta ${maximoCruces} cruces.`,
    );
  }

  const inscritos = new Set(equipoIds);
  const asignados = new Set<string>();

  for (const { localId, visitanteId } of crucesIniciales) {
    for (const equipoId of [localId, visitanteId]) {
      if (equipoId === null) continue;

      if (!inscritos.has(equipoId)) {
        throw new BadRequestException(
          'Uno de los equipos seleccionados no está inscrito en el torneo.',
        );
      }

      if (asignados.has(equipoId)) {
        throw new BadRequestException(
          'Un equipo solo puede ocupar un lugar en la ronda inicial.',
        );
      }

      asignados.add(equipoId);
    }
  }

  const rondas: { ronda: RondaInicial; cruces: CruceLlave[] }[] = [];
  let anteriores: CruceLlave[] = [];

  for (const ronda of RONDAS.slice(inicio)) {
    const cruces = Array.from(
      { length: CAPACIDAD_RONDA[ronda] / 2 },
      (_, indice) => {
        const id = `${ronda}-${indice + 1}`;

        if (ronda === rondaInicial) {
          const inicial = crucesIniciales[indice];

          return resolverCruce(
            id,
            ronda,
            inicial?.localId ?? null,
            inicial?.visitanteId ?? null,
            decisiones,
          );
        }

        return resolverCruce(
          id,
          ronda,
          anteriores[indice * 2]?.ganadorId ?? null,
          anteriores[indice * 2 + 1]?.ganadorId ?? null,
          decisiones,
        );
      },
    );

    rondas.push({ ronda, cruces });
    anteriores = cruces;
  }

  const final = anteriores[0];
  const semifinales = rondas.find(({ ronda }) => ronda === 'SEMIFINAL')?.cruces;

  const tercerLugar = semifinales
    ? resolverCruce(
        'TERCER_LUGAR-1',
        'TERCER_LUGAR',
        perdedor(semifinales[0]),
        perdedor(semifinales[1]),
        decisiones,
      )
    : null;

  // Guarda únicamente las decisiones que coinciden con los cruces actuales.
  const decisionesValidas: DecisionesLlave = {};

  for (const { cruces } of rondas) {
    for (const { id, localId, visitanteId, ganadorId } of cruces) {
      if (localId && visitanteId && ganadorId) {
        decisionesValidas[id] = { localId, visitanteId, ganadorId };
      }
    }
  }

  if (tercerLugar?.localId && tercerLugar.visitanteId && tercerLugar.ganadorId) {
    decisionesValidas[tercerLugar.id] = {
      localId: tercerLugar.localId,
      visitanteId: tercerLugar.visitanteId,
      ganadorId: tercerLugar.ganadorId,
    };
  }

  return {
    rondas,
    tercerLugar,
    decisionesValidas,
    podio: {
      primero: final?.ganadorId ?? null,
      segundo: perdedor(final),
      tercero: tercerLugar?.ganadorId ?? null,
    },
  };
}