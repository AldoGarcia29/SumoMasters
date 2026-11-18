export interface EventoConfig {
  nombreEvento: string;
  lema: string;
  torneoEnVivoId: string | null;
}

export type EventoConfigUpdate = Partial<EventoConfig>;
