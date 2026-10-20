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