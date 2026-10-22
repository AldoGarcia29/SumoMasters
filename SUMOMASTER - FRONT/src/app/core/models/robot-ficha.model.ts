export interface RobotFichaCombate {
  numero: number;
  fase: string;
  estado: string;
  dojo: string | null;
  rival: string;
  horarioProgramado: string | null;
}

export interface RobotFicha {
  torneoId: string;
  robot: {
    id: string;
    nombre: string;
    numero: number | null;
    pesoKg: number | null;
  };
  equipo: {
    nombre: string;
    institucion: string;
  };
  categoria: string;
  grupo: string | null;
  dojo: string | null;
  record: {
    victorias: number;
    derrotas: number;
  };
  ultimoCombate: RobotFichaCombate | null;
  proximoCombate: RobotFichaCombate | null;
}
