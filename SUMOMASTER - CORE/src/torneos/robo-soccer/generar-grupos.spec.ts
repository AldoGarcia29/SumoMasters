import { generarGruposRoboSoccer } from './generar-grupos';

describe('generarGruposRoboSoccer', () => {
  it.each([
    {
      totalEquipos: 25,
      expectedSizes: [4, 4, 4, 4, 4, 5],
      expectedMatches: [6, 6, 6, 6, 6, 10],
      equipoIdConUnRobot: 'equipo-1',
    },
    {
      totalEquipos: 26,
      expectedSizes: [4, 4, 4, 4, 5, 5],
      expectedMatches: [6, 6, 6, 6, 10, 10],
      equipoIdConUnRobot: undefined,
    },
    {
      totalEquipos: 27,
      expectedSizes: [4, 4, 4, 5, 5, 5],
      expectedMatches: [6, 6, 6, 10, 10, 10],
      equipoIdConUnRobot: undefined,
    },
  ])(
    'assigns remainder teams to the last groups for $totalEquipos teams',
    ({ totalEquipos, expectedSizes, expectedMatches, equipoIdConUnRobot }) => {
      const equipoIds = Array.from(
        { length: totalEquipos },
        (_, indice) => `equipo-${indice + 1}`,
      );

      const grupos = generarGruposRoboSoccer(equipoIds, 6, equipoIdConUnRobot);

      expect(grupos.map((grupo) => grupo.equipoIds.length)).toEqual(
        expectedSizes,
      );
      expect(grupos.flatMap((grupo) => grupo.equipoIds)).toHaveLength(
        totalEquipos,
      );
      expect(grupos.map((grupo) => grupo.partidos.length)).toEqual(
        expectedMatches,
      );
      if (equipoIdConUnRobot) {
        expect(grupos[5].equipoIds).toContain(equipoIdConUnRobot);
      }

      for (const grupo of grupos) {
        expect(grupo.partidos).toHaveLength(
          (grupo.equipoIds.length * (grupo.equipoIds.length - 1)) / 2,
        );
        const parejas = grupo.partidos.map(({ localId, visitanteId }) =>
          [localId, visitanteId].sort().join(':'),
        );
        expect(new Set(parejas).size).toBe(grupo.partidos.length);
        expect(
          grupo.partidos.every(
            (partido) =>
              grupo.equipoIds.includes(partido.localId) &&
              grupo.equipoIds.includes(partido.visitanteId) &&
              partido.resultado === null,
          ),
        ).toBe(true);
      }

      expect(
        grupos.reduce((total, grupo) => total + grupo.partidos.length, 0),
      ).toBe(
        expectedSizes.reduce(
          (total, size) => total + (size * (size - 1)) / 2,
          0,
        ),
      );
    },
  );
});
