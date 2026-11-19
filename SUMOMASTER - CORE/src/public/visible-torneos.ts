export function seleccionarTorneosVisiblesEnLive<
  T extends { visibleEnLive?: boolean },
>(torneos: readonly T[]): T[] {
  return torneos.filter((torneo) => torneo.visibleEnLive !== false);
}
