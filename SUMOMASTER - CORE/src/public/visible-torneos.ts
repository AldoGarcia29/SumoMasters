export function seleccionarTorneosVisiblesEnLive<
  T extends { visibleEnLive?: boolean },
>(torneos: readonly T[]): T[] {
  const marcados = torneos.filter((torneo) => torneo.visibleEnLive === true);
  return marcados.length > 0 ? marcados : [...torneos];
}
