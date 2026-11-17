export enum FaseCombate {
  FASE_GRUPOS = 'Fase de grupos',
  PRELIMINAR = 'Ronda preliminar',
  DIECISEISAVOS = 'Dieciseisavos de final',
  OCTAVOS = 'Octavos de final',
  CUARTOS = 'Cuartos de final',
  SEMIFINAL = 'Semifinal',
  TERCER_LUGAR = 'Tercer lugar',
  FINAL = 'Final',
  /** Combate suelto, creado a mano; no forma parte del cuadro del torneo. */
  COMBATE_EXTRA = 'Combate extra',
}

export enum EstadoCombate {
  PENDIENTE = 'Pendiente',
  EN_CURSO = 'En curso',
  FINALIZADO = 'Finalizado',
}

export enum ResultadoCombate {
  GANA_ROBOT_1 = 'Gana Robot 1',
  GANA_ROBOT_2 = 'Gana Robot 2',
  EMPATE = 'Empate',
}

export enum MetodoVictoria {
  EMPUJE_FUERA = 'Empuje fuera del área',
  PUNTOS = 'Puntos',
  KO = 'Fuera de combate (KO)',
  DESCALIFICACION = 'Descalificación',
  ABANDONO = 'Abandono',
  OTRO = 'Otro',
}
