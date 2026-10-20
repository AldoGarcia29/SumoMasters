import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Robot, RobotPayload } from '../models/robot.model';

@Injectable({ providedIn: 'root' })
export class RobotService {
  private readonly apiUrl = `${environment.coreApiUrl}/robots`;

  constructor(private readonly http: HttpClient) {}

  async findAll(filters?: {
    search?: string;
    equipo?: string;
    categoria?: string;
    estado?: string;
  }): Promise<any[]> {
    // Cambiamos temporalmente a any[] para inyectar los nombres
    const query: Record<string, unknown> = {};

    if (filters?.equipo) query.equipo = filters.equipo;
    if (filters?.categoria) query.categoria = filters.categoria;
    if (filters?.estado) query.estado = filters.estado;
    if (filters?.search) {
      query.nombre = { $regex: filters.search, $options: 'i' };
    }

    // 1. Traemos los robots limpios sin populate (esto jamás fallará)
    const robots = await this.robotModel
      .find(query)
      .sort({ createdAt: -1 })
      .lean() // .lean() nos permite modificar el objeto plano de JS fácilmente
      .exec();

    // Si no hay robots, regresamos vacío
    if (!robots.length) return [];

    // 2. Extraemos los IDs únicos de equipos y categorías para buscarlos de golpe
    const equipoIds = [...new Set(robots.map((r) => r.equipo))];
    const categoriaIds = [...new Set(robots.map((r) => r.categoria))];

    // 3. Consultamos las colecciones directamente con sus modelos (asegúrate de inyectar sus Model en el constructor del servicio)
    // O puedes usar los servicios correspondientes si ya los tienes inyectados.

    // Ejemplo si inyectas los Model en el constructor:
    /*
    const equipos = await this.equipoModel.find({ _id: { $in: equipoIds } }).select('nombre institucion').lean();
    const categorias = await this.categoriaModel.find({ _id: { $in: categoriaIds } }).select('nombre tipoCombate').lean();

    // 4. Mapeamos los datos para entregárselos al frontend exactamente como los espera
    const equiposMap = new Map(equipos.map(e => [String(e._id), e]));
    const categoriasMap = new Map(categorias.map(c => [String(c._id), c]));

    return robots.map(robot => ({
      ...robot,
      equipo: equiposMap.get(String(robot.equipo)) || robot.equipo,
      categoria: categoriasMap.get(String(robot.categoria)) || robot.categoria,
    }));
    */

    return robots;
  }
  findOne(id: string): Observable<Robot> {
    return this.http.get<Robot>(`${this.apiUrl}/${id}`);
  }

  create(payload: RobotPayload): Observable<Robot> {
    return this.http.post<Robot>(this.apiUrl, payload);
  }

  update(id: string, payload: Partial<RobotPayload>): Observable<Robot> {
    return this.http.patch<Robot>(`${this.apiUrl}/${id}`, payload);
  }

  remove(id: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.apiUrl}/${id}`);
  }
}
