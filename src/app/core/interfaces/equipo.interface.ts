export interface Equipo {
  _id: string;
  nombreEquipo: string;
  institucion: string;
  integrantes: string[];

  categoriaId:
    | string
    | {
        _id?: string;
        nombre?: string;
      };

  torneoId:
    | string
    | {
        _id?: string;
        nombre?: string;
      };

  robotIds: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CrearEquipo {
  nombreEquipo: string;
  institucion: string;
  integrantes: string[];
  categoriaId: string;
  torneoId: string;
}