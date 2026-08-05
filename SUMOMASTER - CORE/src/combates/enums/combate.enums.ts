export enum FaseCombate {
  FASE_GRUPOS = 'Fase de grupos',
  OCTAVOS = 'Octavos de final',
  CUARTOS = 'Cuartos de final',
  SEMIFINAL = 'Semifinal',
  FINAL = 'Final',
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
}
