import { Combate, EstadoCombate, ResultadoCombate } from '../models/combate.model';
import { FilaRanking } from '../models/ranking.model';

const PUNTOS_VICTORIA = 3;
const PUNTOS_EMPATE = 1;

/**
 * Réplica en el cliente del cálculo que hace `RankingService` en el backend
 * (mismos puntos y mismos 3 primeros criterios de desempate; se omite el
 * 4to criterio —enfrentamiento directo— por simplicidad). Se usa solo como
 * respaldo cuando la consulta al backend viene vacía pero sabemos, por el
 * caché de la sesión, que sí hay combates finalizados.
 */
export function calcularRankingLocal(combates: Combate[]): FilaRanking[] {
  interface Acumulado {
    robotId: string;
    robotNombre: string;
    robotImagenUrl: string;
    equipoId: string;
    equipoNombre: string;
    combates: number;
    victorias: number;
    empates: number;
    derrotas: number;
    ultimoResultado: 'Victoria' | 'Derrota' | 'Empate' | null;
    ultimaFecha: number;
  }

  const stats = new Map<string, Acumulado>();

  const registrar = (
    robot: Combate['robot1'],
    resultado: 'Victoria' | 'Derrota' | 'Empate',
    fecha: number,
  ) => {
    if (!robot) return;
    const equipo = robot.equipo;
    const equipoId = typeof equipo === 'string' ? equipo : equipo?._id ?? '';
    const equipoNombre = typeof equipo === 'string' ? equipo : equipo?.nombre ?? '—';

    const actual = stats.get(robot._id) ?? {
      robotId: robot._id,
      robotNombre: robot.nombre,
      robotImagenUrl: robot.imagenUrl ?? '',
      equipoId,
      equipoNombre,
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

    stats.set(robot._id, actual);
  };

  for (const combate of combates) {
    if (combate.estado !== EstadoCombate.FINALIZADO) continue;

    const fecha = combate.updatedAt ? new Date(combate.updatedAt).getTime() : 0;

    if (combate.resultado === ResultadoCombate.EMPATE) {
      registrar(combate.robot1, 'Empate', fecha);
      registrar(combate.robot2, 'Empate', fecha);
    } else if (combate.resultado === ResultadoCombate.GANA_ROBOT_1) {
      registrar(combate.robot1, 'Victoria', fecha);
      registrar(combate.robot2, 'Derrota', fecha);
    } else if (combate.resultado === ResultadoCombate.GANA_ROBOT_2) {
      registrar(combate.robot2, 'Victoria', fecha);
      registrar(combate.robot1, 'Derrota', fecha);
    }
  }

  const filas = Array.from(stats.values()).map((item) => ({
    ...item,
    puntos: item.victorias * PUNTOS_VICTORIA + item.empates * PUNTOS_EMPATE,
    diferencia: item.victorias - item.derrotas,
  }));

  filas.sort((a, b) => {
    if (b.puntos !== a.puntos) return b.puntos - a.puntos;
    if (b.diferencia !== a.diferencia) return b.diferencia - a.diferencia;
    return b.victorias - a.victorias;
  });

  return filas.map((fila, index) => ({ ...fila, posicion: index + 1 }));
}
