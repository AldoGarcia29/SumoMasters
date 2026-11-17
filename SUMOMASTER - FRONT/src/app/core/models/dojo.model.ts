export enum EstadoDojo {
  DISPONIBLE = 'Disponible',
  OCUPADO = 'Ocupado',
  MANTENIMIENTO = 'Mantenimiento',
}

export interface Dojo {
  _id: string;
  nombre: string;
  estado: EstadoDojo;
  capacidad: number;
}

export interface DojoPayload {
  nombre: string;
  estado?: EstadoDojo;
  capacidad?: number;
}

export interface DojoResumen {
  dojo: Dojo;
  combatesAsignados: number;
}
