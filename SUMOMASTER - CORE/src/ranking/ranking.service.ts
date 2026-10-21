import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { CombatesService } from '../combates/combates.service';
import { CombateDocument } from '../combates/schemas/combate.schema';
import {
  EstadoCombate,
  FaseCombate,
  ResultadoCombate,
} from '../combates/enums/combate.enums';

import { GenerarCuadroManualDto } from './dto/generar-cuadro-manual.dto';



export interface LugarPodio {
  robotId: string;
  robotNombre: string;
  robotImagenUrl: string;
  equipoId: string;
  equipoNombre: string;
}

export interface PodioTorneo {
  torneoId: string;
  torneoFinalizado: boolean;
  campeon: LugarPodio;
  subcampeon: LugarPodio;
  tercerLugar: LugarPodio;
  cuartoLugar: LugarPodio;
}

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
  ultimoResultado:
    | 'Victoria'
    | 'Derrota'
    | 'Empate'
    | null;
}

export interface Clasificado extends FilaRanking {
  bloqueId: string;
  bloqueNombre: string;
  posicionBloque: number;
  porcentajePuntos: number;
  seedGeneral: number;
  paseDirecto: boolean;
}

export interface CrucePreliminar {
  numero: number;
  robot1: Clasificado;
  robot2: Clasificado;
}

export interface BloqueClasificados {
  bloqueId: string;
  bloqueNombre: string;
  clasificados: Clasificado[];
}

export interface ResumenClasificados {
  bloques: BloqueClasificados[];
  clasificados: Clasificado[];
  pasesDirectos: Clasificado[];
  rondaPreliminar: CrucePreliminar[];

  totalBloques: number;
  clasificadosPorBloque: number;
  totalClasificados: number;

  tamanoCuadro: number;
  totalPasesDirectos: number;
  totalPreliminares: number;
  participantesPrimeraRonda: number;
  requierePreliminar: boolean;
  esCuadroCompleto: boolean;
}

const PUNTOS_VICTORIA = 3;
const PUNTOS_EMPATE = 1;
const CLASIFICADOS_POR_BLOQUE = 4;

@Injectable()
export class RankingService {

  async generarCuadroManual(
  torneoId: string,
  dto: GenerarCuadroManualDto,
) {
  const combatesPorFase: Partial<Record<FaseCombate, number>> = {
    [FaseCombate.DIECISEISAVOS]: 16,
    [FaseCombate.OCTAVOS]: 8,
    [FaseCombate.CUARTOS]: 4,
    [FaseCombate.SEMIFINAL]: 2,
  };

  const esperados = combatesPorFase[dto.faseInicial];

  if (!esperados || dto.cruces.length !== esperados) {
    throw new BadRequestException(
      `"${dto.faseInicial}" requiere ${esperados ?? 0} combates.`,
    );
  }

  const todos = await this.combatesService.findByTorneo(torneoId);

  const grupos = todos.filter(
    (combate) => combate.fase === FaseCombate.FASE_GRUPOS,
  );

  if (
    grupos.length === 0 ||
    grupos.some(
      (combate) =>
        combate.estado !== EstadoCombate.FINALIZADO ||
        !combate.resultado,
    )
  ) {
    throw new ConflictException(
      'Primero deben finalizar todos los combates de la fase de grupos con resultados válidos.',
    );
  }

  // En este primer paso el cuadro se confirma una sola vez.
  // Evita mezclar el cuadro manual con eliminatorias anteriores.
  if (
    todos.some(
      (combate) => combate.fase !== FaseCombate.FASE_GRUPOS,
    )
  ) {
    throw new ConflictException(
      'Este torneo ya tiene un cuadro eliminatorio. No se puede crear otro.',
    );
  }

  const ranking = await this.calcular(torneoId);
  const permitidos = new Set(
    ranking.map((fila) => fila.robotId),
  );

  const usados = new Set<string>();

  for (const cruce of dto.cruces) {
    for (const robotId of [cruce.robot1Id, cruce.robot2Id]) {
      if (!permitidos.has(robotId)) {
        throw new BadRequestException(
          'Uno de los robots seleccionados no pertenece a la clasificación de este torneo.',
        );
      }

      if (usados.has(robotId)) {
        throw new BadRequestException(
          'Un robot no puede aparecer dos veces en el cuadro.',
        );
      }

      usados.add(robotId);
    }
  }

  const cruces = dto.cruces.map((cruce, indice) => ({
    numero: indice + 1,
    robot1Id: cruce.robot1Id,
    robot2Id: cruce.robot2Id,
  }));

  const combatesGenerados =
    await this.combatesService.generarRondaEliminatoria(
      torneoId,
      dto.faseInicial,
      cruces,
    );

  return {
    faseInicial: dto.faseInicial,
    combatesGenerados,
    mensaje: `Se crearon ${combatesGenerados.length} combates de ${dto.faseInicial}.`,
  };
}

  constructor(
    private readonly combatesService: CombatesService,
  ) {}

  private potenciaDeDosInferior(total: number): number {
  if (total <= 0) {
    return 0;
  }

  return 2 ** Math.floor(Math.log2(total));
}
private determinarPrimeraFase(
  resumen: ResumenClasificados,
): FaseCombate {
  if (resumen.requierePreliminar) {
    return FaseCombate.PRELIMINAR;
  }

  switch (resumen.tamanoCuadro) {
    case 32:
      return FaseCombate.DIECISEISAVOS;

    case 16:
      return FaseCombate.OCTAVOS;

    case 8:
      return FaseCombate.CUARTOS;

    case 4:
      return FaseCombate.SEMIFINAL;

    case 2:
      return FaseCombate.FINAL;

    default:
      throw new BadRequestException(
        `No existe una fase configurada para un cuadro de ${resumen.tamanoCuadro} participantes.`,
      );
  }
}


private mapearLugarPodio(robot: any): LugarPodio {
  const equipo = robot?.equipo ?? {};

  return {
    robotId:
      robot?._id?.toString() ??
      robot?.toString() ??
      '',
    robotNombre:
      robot?.nombre ?? 'Robot',
    robotImagenUrl:
      robot?.imagenUrl ?? '',
    equipoId:
      equipo?._id?.toString() ?? '',
    equipoNombre:
      equipo?.nombre ?? 'Sin equipo',
  };
}

private obtenerGanadorCombate(
  combate: CombateDocument,
): any {
  if (
    combate.resultado ===
    ResultadoCombate.GANA_ROBOT_1
  ) {
    return combate.robot1;
  }

  if (
    combate.resultado ===
    ResultadoCombate.GANA_ROBOT_2
  ) {
    return combate.robot2;
  }

  throw new BadRequestException(
    `El combate ${combate.numero} no tiene un ganador válido.`,
  );
}

private obtenerPerdedorCombate(
  combate: CombateDocument,
): any {
  if (
    combate.resultado ===
    ResultadoCombate.GANA_ROBOT_1
  ) {
    return combate.robot2;
  }

  if (
    combate.resultado ===
    ResultadoCombate.GANA_ROBOT_2
  ) {
    return combate.robot1;
  }

  throw new BadRequestException(
    `El combate ${combate.numero} no tiene un perdedor válido.`,
  );
}

async obtenerPodio(
  torneoId: string,
): Promise<PodioTorneo> {
  const [finales, terceros] = await Promise.all([
    this.combatesService.findByTorneo(torneoId, {
      fase: FaseCombate.FINAL,
    }),
    this.combatesService.findByTorneo(torneoId, {
      fase: FaseCombate.TERCER_LUGAR,
    }),
  ]);

  if (finales.length === 0) {
    throw new NotFoundException(
      'Todavía no existe el combate final.',
    );
  }

  if (terceros.length === 0) {
    throw new ConflictException(
      'Todavía no existe el combate por tercer lugar.',
    );
  }

  if (finales.length !== 1 || terceros.length !== 1) {
    throw new ConflictException(
      'Debe existir una sola final y un solo combate por tercer lugar.',
    );
  }

  const final = finales[0];
  const tercerLugar = terceros[0];

  if (final.estado !== EstadoCombate.FINALIZADO) {
    throw new ConflictException(
      'El combate final todavía no ha terminado.',
    );
  }

  if (tercerLugar.estado !== EstadoCombate.FINALIZADO) {
    throw new ConflictException(
      'Debes registrar el resultado del tercer lugar antes de consultar el podio.',
    );
  }

  const tieneGanador = (combate: CombateDocument): boolean =>
    combate.resultado === ResultadoCombate.GANA_ROBOT_1 ||
    combate.resultado === ResultadoCombate.GANA_ROBOT_2;

  if (!tieneGanador(final)) {
    throw new ConflictException(
      'La final debe tener un ganador; no puede quedar empatada.',
    );
  }

  if (!tieneGanador(tercerLugar)) {
    throw new ConflictException(
      'El combate por tercer lugar debe tener un ganador; no puede quedar empatado.',
    );
  }

  const participantes = [
    this.obtenerRobotId(final.robot1),
    this.obtenerRobotId(final.robot2),
    this.obtenerRobotId(tercerLugar.robot1),
    this.obtenerRobotId(tercerLugar.robot2),
  ];

  if (
    participantes.some((id) => !id) ||
    new Set(participantes).size !== 4
  ) {
    throw new ConflictException(
      'La final y el tercer lugar deben tener cuatro participantes distintos.',
    );
  }

  return {
    torneoId,
    torneoFinalizado: true,
    campeon: this.mapearLugarPodio(
      this.obtenerGanadorCombate(final),
    ),
    subcampeon: this.mapearLugarPodio(
      this.obtenerPerdedorCombate(final),
    ),
    tercerLugar: this.mapearLugarPodio(
      this.obtenerGanadorCombate(tercerLugar),
    ),
    cuartoLugar: this.mapearLugarPodio(
      this.obtenerPerdedorCombate(tercerLugar),
    ),
  };
}

private obtenerSiguienteFase(
  faseActual: FaseCombate,
): FaseCombate {
  const fases: Partial<
    Record<FaseCombate, FaseCombate>
  > = {
    [FaseCombate.OCTAVOS]:
      FaseCombate.CUARTOS,

    [FaseCombate.CUARTOS]:
      FaseCombate.SEMIFINAL,

    [FaseCombate.SEMIFINAL]:
      FaseCombate.FINAL,
  };

  const siguiente = fases[faseActual];

  if (!siguiente) {
    throw new BadRequestException(
      `No existe una ronda posterior a "${faseActual}".`,
    );
  }

  return siguiente;
}

private obtenerRobotId(robot: any): string {
  return (
    robot?._id?.toString() ??
    robot?.toString() ??
    ''
  );
}

private obtenerGanadorId(
  combate: CombateDocument,
): string {
  if (
    combate.resultado ===
    ResultadoCombate.GANA_ROBOT_1
  ) {
    return this.obtenerRobotId(combate.robot1);
  }

  if (
    combate.resultado ===
    ResultadoCombate.GANA_ROBOT_2
  ) {
    return this.obtenerRobotId(combate.robot2);
  }

  throw new BadRequestException(
    `El combate ${combate.numero} no tiene un ganador válido.`,
  );
}

async generarSiguienteRonda(
  torneoId: string,
  faseActual: FaseCombate,
): Promise<{
  faseActual: FaseCombate;
  siguienteFase: FaseCombate;
  participantes: number;
  combatesGenerados: CombateDocument[];
}> {
  const siguienteFase =
    this.obtenerSiguienteFase(faseActual);

  const combatesActuales =
    await this.combatesService.findByTorneo(
      torneoId,
      {
        fase: faseActual,
      },
    );

  if (combatesActuales.length === 0) {
    throw new BadRequestException(
      `No existen combates de "${faseActual}".`,
    );
  }

  const noFinalizados = combatesActuales.filter(
    (combate) =>
      combate.estado !==
      EstadoCombate.FINALIZADO,
  );

  if (noFinalizados.length > 0) {
    throw new ConflictException(
      `Todavía faltan ${noFinalizados.length} combates de "${faseActual}" por finalizar.`,
    );
  }

  const empates = combatesActuales.filter(
    (combate) =>
      combate.resultado ===
      ResultadoCombate.EMPATE,
  );

  if (empates.length > 0) {
    throw new ConflictException(
      'No se puede avanzar porque existen combates eliminatorios empatados.',
    );
  }

  // Al avanzar desde semifinales, crea también el tercer lugar.
if (faseActual === FaseCombate.SEMIFINAL) {
  if (combatesActuales.length !== 2) {
    throw new ConflictException(
      'Deben existir exactamente dos semifinales para generar la final y el tercer lugar.',
    );
  }

  const semifinales = [...combatesActuales].sort(
    (a, b) => a.numero - b.numero,
  );

  // Valida los ganadores antes de guardar el nuevo combate.
  for (const semifinal of semifinales) {
    this.obtenerGanadorId(semifinal);
  }

  const perdedores = semifinales.map(
    (semifinal, indice) => ({
      robotId: this.obtenerRobotId(
        this.obtenerPerdedorCombate(semifinal),
      ),
      seed: indice + 1,
    }),
  );

  if (
    perdedores.some((robot) => !robot.robotId) ||
    perdedores[0].robotId === perdedores[1].robotId
  ) {
    throw new ConflictException(
      'No se pudieron determinar dos perdedores distintos para el tercer lugar.',
    );
  }

  await this.combatesService.crearCombatesEliminatorios(
    torneoId,
    FaseCombate.TERCER_LUGAR,
    perdedores,
  );
}

  const ganadores = [...combatesActuales]
    .sort(
      (a, b) =>
        (a.numero ?? 0) - (b.numero ?? 0),
    )
    .map((combate, index) => ({
      robotId: this.obtenerGanadorId(combate),
      seed: index + 1,
    }));

  let participantes = ganadores;

  /*
   * En tu formato actual:
   *
   * 12 clasificados
   * 4 tienen pase directo
   * 8 disputan Octavos
   * 4 ganadores + 4 pases = 8 para Cuartos
   */
  if (
    faseActual === FaseCombate.OCTAVOS &&
    siguienteFase === FaseCombate.CUARTOS
  ) {
    const resumen =
      await this.obtenerClasificados(torneoId);

    const pasesDirectos =
      resumen.pasesDirectos.map(
        (clasificado: any) => ({
          robotId: clasificado.robotId,
          seed:
            clasificado.seedGeneral ??
            clasificado.posicion ??
            999,
        }),
      );

    participantes = [
      ...pasesDirectos,
      ...ganadores.map((ganador, index) => ({
        ...ganador,
        seed:
          pasesDirectos.length +
          index +
          1,
      })),
    ];
  }

  const participantesUnicos = Array.from(
    new Map(
      participantes.map((participante) => [
        participante.robotId,
        participante,
      ]),
    ).values(),
  );

  participantesUnicos.sort(
    (a, b) =>
      (a.seed ?? 999) - (b.seed ?? 999),
  );

  if (
    participantesUnicos.length < 2 ||
    participantesUnicos.length % 2 !== 0
  ) {
    throw new BadRequestException(
      `No se puede crear "${siguienteFase}" con ${participantesUnicos.length} participantes.`,
    );
  }

  const combatesGenerados =
    await this.combatesService
      .crearCombatesEliminatorios(
        torneoId,
        siguienteFase,
        participantesUnicos,
      );

  return {
    faseActual,
    siguienteFase,
    participantes:
      participantesUnicos.length,
    combatesGenerados,
  };
}

private calcularFormatoEliminatorio(
  totalClasificados: number,
): {
  tamanoCuadro: number;
  cantidadPasesDirectos: number;
  cantidadCombatesPrimeraRonda: number;
  participantesPrimeraRonda: number;
  requierePreliminar: boolean;
  esCuadroCompleto: boolean;
} {
  if (totalClasificados < 2) {
    return {
      tamanoCuadro: totalClasificados,
      cantidadPasesDirectos: 0,
      cantidadCombatesPrimeraRonda: 0,
      participantesPrimeraRonda: 0,
      requierePreliminar: false,
      esCuadroCompleto: false,
    };
  }

  const tamanoCuadro =
    this.potenciaDeDosInferior(
      totalClasificados,
    );

  const esCuadroCompleto =
    tamanoCuadro === totalClasificados;

  /*
   * Si el total ya es potencia de 2:
   *
   * 8  robots -> 4 combates de cuartos
   * 16 robots -> 8 combates de octavos
   * 32 robots -> 16 combates
   *
   * Ningún robot recibe pase directo.
   */
  if (esCuadroCompleto) {
    return {
      tamanoCuadro,
      cantidadPasesDirectos: 0,
      cantidadCombatesPrimeraRonda:
        totalClasificados / 2,
      participantesPrimeraRonda:
        totalClasificados,
      requierePreliminar: false,
      esCuadroCompleto: true,
    };
  }

  /*
   * Ejemplo con 12:
   *
   * Cuadro objetivo: 8
   * Preliminares: 12 - 8 = 4
   * Participantes: 4 * 2 = 8
   * Pases directos: 12 - 8 = 4
   *
   * Ejemplo con 20:
   *
   * Cuadro objetivo: 16
   * Preliminares: 20 - 16 = 4
   * Participantes: 8
   * Pases directos: 12
   */
  const cantidadCombatesPrimeraRonda =
    totalClasificados - tamanoCuadro;

  const participantesPrimeraRonda =
    cantidadCombatesPrimeraRonda * 2;

  const cantidadPasesDirectos =
    totalClasificados -
    participantesPrimeraRonda;

  return {
    tamanoCuadro,
    cantidadPasesDirectos,
    cantidadCombatesPrimeraRonda,
    participantesPrimeraRonda,
    requierePreliminar: true,
    esCuadroCompleto: false,
  };
}

  async calcular(
    torneoId: string,
    filtros?: {
      bloque?: string;
      dojo?: string;
    },
  ): Promise<FilaRanking[]> {
    const combates =
      await this.combatesService.findByTorneo(
        torneoId,
        {
          bloque: filtros?.bloque,
          dojo: filtros?.dojo,
          estado: EstadoCombate.FINALIZADO,
          // El ranking corresponde únicamente a la fase
          // de grupos. Los resultados eliminatorios no
          // deben modificar esta tabla.
          fase: FaseCombate.FASE_GRUPOS,
        },
      );

    const stats = new Map<
      string,
      {
        robot: CombateDocument['robot1'];
        combates: number;
        victorias: number;
        empates: number;
        derrotas: number;
        ultimoResultado:
          | 'Victoria'
          | 'Derrota'
          | 'Empate'
          | null;
        ultimaFecha: number;
      }
    >();

    const registrar = (
      robot: any,
      resultado:
        | 'Victoria'
        | 'Derrota'
        | 'Empate',
      fecha: number,
    ): void => {
      if (!robot) return;

      const id =
        robot._id?.toString() ??
        robot.toString();

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

      if (resultado === 'Victoria') {
        actual.victorias += 1;
      }

      if (resultado === 'Empate') {
        actual.empates += 1;
      }

      if (resultado === 'Derrota') {
        actual.derrotas += 1;
      }

      if (fecha >= actual.ultimaFecha) {
        actual.ultimoResultado = resultado;
        actual.ultimaFecha = fecha;
      }

      stats.set(id, actual);
    };

    const enfrentamientosDirectos = new Map<
      string,
      Map<
        string,
        'Victoria' | 'Derrota' | 'Empate'
      >
    >();

    const registrarDuelo = (
      idA: string,
      idB: string,
      resultado:
        | 'Victoria'
        | 'Derrota'
        | 'Empate',
    ): void => {
      if (!idA || !idB) return;

      if (
        !enfrentamientosDirectos.has(idA)
      ) {
        enfrentamientosDirectos.set(
          idA,
          new Map(),
        );
      }

      enfrentamientosDirectos
        .get(idA)!
        .set(idB, resultado);
    };

    for (const combate of combates) {
      const fecha = (combate as any).updatedAt
        ? new Date(
            (combate as any).updatedAt,
          ).getTime()
        : 0;

      const robot1: any = combate.robot1;
      const robot2: any = combate.robot2;

      const id1 =
        robot1?._id?.toString() ?? '';

      const id2 =
        robot2?._id?.toString() ?? '';

      if (
        combate.resultado ===
        ResultadoCombate.EMPATE
      ) {
        registrar(
          combate.robot1,
          'Empate',
          fecha,
        );

        registrar(
          combate.robot2,
          'Empate',
          fecha,
        );

        registrarDuelo(
          id1,
          id2,
          'Empate',
        );

        registrarDuelo(
          id2,
          id1,
          'Empate',
        );
      } else if (
        combate.resultado ===
        ResultadoCombate.GANA_ROBOT_1
      ) {
        registrar(
          combate.robot1,
          'Victoria',
          fecha,
        );

        registrar(
          combate.robot2,
          'Derrota',
          fecha,
        );

        registrarDuelo(
          id1,
          id2,
          'Victoria',
        );

        registrarDuelo(
          id2,
          id1,
          'Derrota',
        );
      } else if (
        combate.resultado ===
        ResultadoCombate.GANA_ROBOT_2
      ) {
        registrar(
          combate.robot2,
          'Victoria',
          fecha,
        );

        registrar(
          combate.robot1,
          'Derrota',
          fecha,
        );

        registrarDuelo(
          id2,
          id1,
          'Victoria',
        );

        registrarDuelo(
          id1,
          id2,
          'Derrota',
        );
      }
    }

    const filas: Omit<
      FilaRanking,
      'posicion'
    >[] = Array.from(
      stats.values(),
    ).map((item) => {
      const robot: any = item.robot;
      const equipo =
        robot?.equipo ?? {};

      const puntos =
        item.victorias *
          PUNTOS_VICTORIA +
        item.empates * PUNTOS_EMPATE;

      const diferencia =
        item.victorias -
        item.derrotas;

      return {
        robotId:
          robot?._id?.toString() ?? '',

        robotNombre:
          robot?.nombre ?? 'Robot',

        robotImagenUrl:
          robot?.imagenUrl ?? '',

        equipoId:
          equipo?._id?.toString() ?? '',

        equipoNombre:
          equipo?.nombre ?? '—',

        combates: item.combates,
        victorias: item.victorias,
        empates: item.empates,
        derrotas: item.derrotas,
        puntos,
        diferencia,
        ultimoResultado:
          item.ultimoResultado,
      };
    });

    /*
     * Criterios de desempate:
     * 1. Puntos
     * 2. Diferencia
     * 3. Victorias
     * 4. Enfrentamiento directo
     * 5. Nombre, para mantener orden estable
     */
    filas.sort((a, b) => {
      if (b.puntos !== a.puntos) {
        return b.puntos - a.puntos;
      }

      if (
        b.diferencia !== a.diferencia
      ) {
        return (
          b.diferencia - a.diferencia
        );
      }

      if (
        b.victorias !== a.victorias
      ) {
        return (
          b.victorias - a.victorias
        );
      }

      const duelo =
        enfrentamientosDirectos
          .get(a.robotId)
          ?.get(b.robotId);

      if (duelo === 'Victoria') {
        return -1;
      }

      if (duelo === 'Derrota') {
        return 1;
      }

      return a.robotNombre.localeCompare(
        b.robotNombre,
      );
    });

    return filas.map(
      (fila, index) => ({
        ...fila,
        posicion: index + 1,
      }),
    );
  }

  async obtenerClasificados(
    torneoId: string,
  ): Promise<ResumenClasificados> {
    const combatesFaseGrupos =
      await this.combatesService.findByTorneo(
        torneoId,
        {
          fase: FaseCombate.FASE_GRUPOS,
        },
      );

    if (
      combatesFaseGrupos.length === 0
    ) {
      throw new BadRequestException(
        'El torneo todavía no tiene combates de fase de grupos.',
      );
    }

    const pendientes =
      combatesFaseGrupos.filter(
        (combate) =>
          combate.estado !==
          EstadoCombate.FINALIZADO,
      );

    if (pendientes.length > 0) {
      throw new BadRequestException(
        `Todavía faltan ${pendientes.length} combates de la fase de grupos por finalizar.`,
      );
    }

    const bloquesMap = new Map<
      string,
      {
        bloqueId: string;
        bloqueNombre: string;
      }
    >();

    for (
      const combate of combatesFaseGrupos
    ) {
      const bloque: any =
        combate.bloque;

      if (!bloque) continue;

      const bloqueId =
        bloque._id?.toString() ??
        bloque.toString();

      const bloqueNombre =
        bloque.nombre ?? 'Bloque';

      bloquesMap.set(bloqueId, {
        bloqueId,
        bloqueNombre,
      });
    }

    const bloquesOrdenados =
      Array.from(
        bloquesMap.values(),
      ).sort((a, b) =>
        a.bloqueNombre.localeCompare(
          b.bloqueNombre,
        ),
      );

    if (
      bloquesOrdenados.length === 0
    ) {
      throw new BadRequestException(
        'No se encontraron bloques válidos para el torneo.',
      );
    }

    const bloques: BloqueClasificados[] =
      [];

    const clasificadosIniciales: Clasificado[] =
      [];

    for (
      const bloque of bloquesOrdenados
    ) {
      const ranking =
        await this.calcular(
          torneoId,
          {
            bloque: bloque.bloqueId,
          },
        );

      const primerosCuatro = ranking
        .slice(
          0,
          CLASIFICADOS_POR_BLOQUE,
        )
        .map(
          (
            fila,
          ): Clasificado => {
            const maximoPuntos =
              fila.combates > 0
                ? fila.combates *
                  PUNTOS_VICTORIA
                : 1;

            return {
              ...fila,
              bloqueId:
                bloque.bloqueId,
              bloqueNombre:
                bloque.bloqueNombre,
              posicionBloque:
                fila.posicion,
              porcentajePuntos:
                fila.puntos /
                maximoPuntos,
              seedGeneral: 0,
              paseDirecto: false,
            };
          },
        );

      bloques.push({
        bloqueId:
          bloque.bloqueId,
        bloqueNombre:
          bloque.bloqueNombre,
        clasificados:
          primerosCuatro,
      });

      clasificadosIniciales.push(
        ...primerosCuatro,
      );
    }

    if (
      clasificadosIniciales.length < 2
    ) {
      throw new BadRequestException(
        'No hay suficientes clasificados para generar la fase eliminatoria.',
      );
    }

    /*
     * Orden general normalizado.
     *
     * Esto evita favorecer a los robots de
     * bloques con más participantes y, por lo
     * tanto, más combates disputados.
     */
    const clasificadosOrdenados = [
      ...clasificadosIniciales,
    ].sort((a, b) => {
      if (
        b.porcentajePuntos !==
        a.porcentajePuntos
      ) {
        return (
          b.porcentajePuntos -
          a.porcentajePuntos
        );
      }

      const porcentajeDiferenciaA =
        a.combates > 0
          ? a.diferencia / a.combates
          : 0;

      const porcentajeDiferenciaB =
        b.combates > 0
          ? b.diferencia / b.combates
          : 0;

      if (
        porcentajeDiferenciaB !==
        porcentajeDiferenciaA
      ) {
        return (
          porcentajeDiferenciaB -
          porcentajeDiferenciaA
        );
      }

      const porcentajeVictoriasA =
        a.combates > 0
          ? a.victorias / a.combates
          : 0;

      const porcentajeVictoriasB =
        b.combates > 0
          ? b.victorias / b.combates
          : 0;

      if (
        porcentajeVictoriasB !==
        porcentajeVictoriasA
      ) {
        return (
          porcentajeVictoriasB -
          porcentajeVictoriasA
        );
      }

      if (
        b.puntos !== a.puntos
      ) {
        return b.puntos - a.puntos;
      }

      return a.robotNombre.localeCompare(
        b.robotNombre,
      );
    });

    clasificadosOrdenados.forEach(
      (clasificado, index) => {
        clasificado.seedGeneral =
          index + 1;
      },
    );

    const formato =
  this.calcularFormatoEliminatorio(
    clasificadosOrdenados.length,
  );

const idsPasesDirectos =
  new Set<string>();

/*
 * Si no tenemos un cuadro completo,
 * asignamos los pases directos.
 *
 * Los primeros beneficiados son los
 * ganadores de cada bloque.
 */
if (formato.requierePreliminar) {
  const ganadoresBloque =
    clasificadosOrdenados
      .filter(
        (clasificado) =>
          clasificado.posicionBloque === 1,
      )
      .sort(
        (a, b) =>
          a.seedGeneral -
          b.seedGeneral,
      );

  for (const ganador of ganadoresBloque) {
    if (
      idsPasesDirectos.size >=
      formato.cantidadPasesDirectos
    ) {
      break;
    }

    idsPasesDirectos.add(
      ganador.robotId,
    );
  }

  /*
   * Los pases restantes se entregan
   * según la clasificación general.
   */
  for (
    const clasificado of
      clasificadosOrdenados
  ) {
    if (
      idsPasesDirectos.size >=
      formato.cantidadPasesDirectos
    ) {
      break;
    }

    idsPasesDirectos.add(
      clasificado.robotId,
    );
  }
}

/*
 * En un cuadro completo nadie recibe
 * pase directo: todos juegan.
 */
for (
  const clasificado of
    clasificadosOrdenados
) {
  clasificado.paseDirecto =
    idsPasesDirectos.has(
      clasificado.robotId,
    );
}

const pasesDirectos =
  clasificadosOrdenados.filter(
    (clasificado) =>
      clasificado.paseDirecto,
  );

/*
 * Si requiere preliminar, solamente
 * juegan quienes no tienen pase.
 *
 * Si ya es cuadro completo, juegan
 * todos los clasificados.
 */
const participantesPrimeraRonda =
  formato.requierePreliminar
    ? clasificadosOrdenados.filter(
        (clasificado) =>
          !clasificado.paseDirecto,
      )
    : [...clasificadosOrdenados];

const disponibles = [
  ...participantesPrimeraRonda,
];

const rondaPreliminar: CrucePreliminar[] =
  [];

/*
 * Mejor seed contra peor seed.
 * Cuando sea posible evita repetir
 * enfrentamientos del mismo bloque.
 */
while (disponibles.length >= 2) {
  const robot1 =
    disponibles.shift()!;

  let indiceRival = -1;

  for (
    let index =
      disponibles.length - 1;
    index >= 0;
    index--
  ) {
    if (
      disponibles[index].bloqueId !==
      robot1.bloqueId
    ) {
      indiceRival = index;
      break;
    }
  }

  if (indiceRival === -1) {
    indiceRival =
      disponibles.length - 1;
  }

  const [robot2] =
    disponibles.splice(
      indiceRival,
      1,
    );

  rondaPreliminar.push({
    numero:
      rondaPreliminar.length + 1,
    robot1,
    robot2,
  });
}

    const clasificadosPorId = new Map(
      clasificadosOrdenados.map(
        (clasificado) => [
          clasificado.robotId,
          clasificado,
        ],
      ),
    );

    for (const bloque of bloques) {
      bloque.clasificados =
        bloque.clasificados.map(
          (clasificado) =>
            clasificadosPorId.get(
              clasificado.robotId,
            ) ?? clasificado,
        );
    }

    return {
  bloques,
  clasificados:
    clasificadosOrdenados,
  pasesDirectos,
  rondaPreliminar,

  totalBloques:
    bloques.length,

  clasificadosPorBloque:
    CLASIFICADOS_POR_BLOQUE,

  totalClasificados:
    clasificadosOrdenados.length,

  tamanoCuadro:
    formato.tamanoCuadro,

  totalPasesDirectos:
    pasesDirectos.length,

  totalPreliminares:
    formato.requierePreliminar
      ? formato.cantidadCombatesPrimeraRonda
      : 0,

  participantesPrimeraRonda:
    formato.participantesPrimeraRonda,

  requierePreliminar:
    formato.requierePreliminar,

  esCuadroCompleto:
    formato.esCuadroCompleto,
}; }

  async generarFaseEliminatoria(
  torneoId: string,
) {
  const resumen =
    await this.obtenerClasificados(
      torneoId,
    );

  if (
    resumen.totalClasificados < 2
  ) {
    throw new BadRequestException(
      'No hay suficientes clasificados para generar la fase eliminatoria.',
    );
  }

  const faseInicial =
    this.determinarPrimeraFase(
      resumen,
    );

  const cruces =
    resumen.rondaPreliminar.map(
      (cruce) => ({
        numero: cruce.numero,
        robot1Id:
          cruce.robot1.robotId,
        robot2Id:
          cruce.robot2.robotId,
      }),
    );

  if (cruces.length === 0) {
    throw new BadRequestException(
      'No se pudieron formar enfrentamientos eliminatorios.',
    );
  }

  const combatesGenerados =
    await this.combatesService
      .generarRondaEliminatoria(
        torneoId,
        faseInicial,
        cruces,
      );

  const mensaje =
    resumen.requierePreliminar
      ? `Se generaron ${combatesGenerados.length} combates preliminares para completar el cuadro de ${resumen.tamanoCuadro}.`
      : `Se generaron ${combatesGenerados.length} combates de ${faseInicial}.`;

  return {
    ...resumen,
    faseInicial,
    combatesGenerados,
    faseGenerada: true,
    mensaje,
  };
}
}