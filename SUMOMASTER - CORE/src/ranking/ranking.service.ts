import { Injectable } from '@nestjs/common';
import { CombatesService } from '../combates/combates.service';
import { CombateDocument } from '../combates/schemas/combate.schema';
import { ResultadoCombate } from '../combates/enums/combate.enums';

export interface FilaRanking {
  posicion: number;
  robotId: string;
  robotNombre: string;
  robotImagenUrl: string;
  equipoId: string;
  equipoNombre: string;
  combates: number;
  victorias: number;
  empates: number;
  derrotas: number;
  puntos: number;
  diferencia: number;
  ultimoResultado: 'Victoria' | 'Derrota' | 'Empate' | null;
}

const PUNTOS_VICTORIA = 3;
const PUNTOS_EMPATE = 1;

@Injectable()
export class RankingService {
  constructor(private readonly combatesService: CombatesService) {}

  async calcular(
    torneoId: string,
    filtros?: { bloque?: string; dojo?: string },
  ): Promise<FilaRanking[]> {
    const combates = await this.combatesService.findByTorneo(torneoId, {
      ...filtros,
      estado: 'Finalizado',
    });

    const stats = new Map<
      string,
      {
        robot: CombateDocument['robot1'];
        combates: number;
        victorias: number;
        empates: number;
        derrotas: number;
        ultimoResultado: 'Victoria' | 'Derrota' | 'Empate' | null;
        ultimaFecha: number;
      }
    >();

    const registrar = (
      robot: any,
      resultado: 'Victoria' | 'Derrota' | 'Empate',
      fecha: number,
    ) => {
      const id = robot._id?.toString() ?? robot.toString();
      const actual = stats.get(id) ?? {
        robot,
        combates: 0,
        victorias: 0,
        empates: 0,
        derrotas: 0,
        ultimoResultado: null,
        ultimaFecha: 0,
      };

      actual.combates += 1;
      if (resultado === 'Victoria') actual.victorias += 1;
      if (resultado === 'Empate') actual.empates += 1;
      if (resultado === 'Derrota') actual.derrotas += 1;

      if (fecha >= actual.ultimaFecha) {
        actual.ultimoResultado = resultado;
        actual.ultimaFecha = fecha;
      }

      stats.set(id, actual);
    };

    const enfrentamientosDirectos = new Map<string, Map<string, 'Victoria' | 'Derrota' | 'Empate'>>();

    const registrarDuelo = (
      idA: string,
      idB: string,
      resultado: 'Victoria' | 'Derrota' | 'Empate',
    ) => {
      if (!idA || !idB) return;
      if (!enfrentamientosDirectos.has(idA)) enfrentamientosDirectos.set(idA, new Map());
      enfrentamientosDirectos.get(idA)!.set(idB, resultado);
    };

    for (const combate of combates) {
      const fecha = (combate as any).updatedAt
        ? new Date((combate as any).updatedAt).getTime()
        : 0;

      const robot1: any = combate.robot1;
      const robot2: any = combate.robot2;
      const id1 = robot1?._id?.toString() ?? '';
      const id2 = robot2?._id?.toString() ?? '';

      if (combate.resultado === ResultadoCombate.EMPATE) {
        registrar(combate.robot1, 'Empate', fecha);
        registrar(combate.robot2, 'Empate', fecha);
        registrarDuelo(id1, id2, 'Empate');
        registrarDuelo(id2, id1, 'Empate');
      } else if (combate.resultado === ResultadoCombate.GANA_ROBOT_1) {
        registrar(combate.robot1, 'Victoria', fecha);
        registrar(combate.robot2, 'Derrota', fecha);
        registrarDuelo(id1, id2, 'Victoria');
        registrarDuelo(id2, id1, 'Derrota');
      } else if (combate.resultado === ResultadoCombate.GANA_ROBOT_2) {
        registrar(combate.robot2, 'Victoria', fecha);
        registrar(combate.robot1, 'Derrota', fecha);
        registrarDuelo(id2, id1, 'Victoria');
        registrarDuelo(id1, id2, 'Derrota');
      }
    }

    const filas: Omit<FilaRanking, 'posicion'>[] = Array.from(stats.values()).map(
      (item) => {
        const robot: any = item.robot;
        const equipo = robot?.equipo ?? {};
        const puntos = item.victorias * PUNTOS_VICTORIA + item.empates * PUNTOS_EMPATE;
        const diferencia = item.victorias - item.derrotas;

        return {
          robotId: robot?._id?.toString() ?? '',
          robotNombre: robot?.nombre ?? 'Robot',
          robotImagenUrl: robot?.imagenUrl ?? '',
          equipoId: equipo?._id?.toString() ?? '',
          equipoNombre: equipo?.nombre ?? '—',
          combates: item.combates,
          victorias: item.victorias,
          empates: item.empates,
          derrotas: item.derrotas,
          puntos,
          diferencia,
          ultimoResultado: item.ultimoResultado,
        };
      },
    );

    // Criterios de desempate: 1. Puntos, 2. Diferencia, 3. Victorias, 4. Enfrentamiento directo
    filas.sort((a, b) => {
      if (b.puntos !== a.puntos) return b.puntos - a.puntos;
      if (b.diferencia !== a.diferencia) return b.diferencia - a.diferencia;
      if (b.victorias !== a.victorias) return b.victorias - a.victorias;

      const duelo = enfrentamientosDirectos.get(a.robotId)?.get(b.robotId);
      if (duelo === 'Victoria') return -1;
      if (duelo === 'Derrota') return 1;
      return 0;
    });

    return filas.map((fila, index) => ({ ...fila, posicion: index + 1 }));
  }
}
