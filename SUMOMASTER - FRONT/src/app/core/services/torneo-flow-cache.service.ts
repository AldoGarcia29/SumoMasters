import { Injectable } from '@angular/core';
import { Bloque } from '../models/bloque.model';
import { Combate } from '../models/combate.model';

/**
 * Caché defensivo, en memoria, que vive mientras dure la sesión de la SPA
 * (se pierde al recargar la página, pero sobrevive a la navegación interna
 * entre pantallas).
 *
 * Por qué existe: hay una inconsistencia detectada entre lo que el backend
 * escribe (generar bloques / generar combates) y lo que una consulta GET
 * separada, inmediatamente posterior, puede llegar a devolver. Mientras esa
 * causa de fondo se investiga (probablemente relacionada con el nodo de
 * lectura de MongoDB), este caché evita que la interfaz se vea rota:
 * - Cada vez que una pantalla genera u obtiene datos con éxito y NO vacíos,
 *   los guarda aquí.
 * - Cada pantalla, al cargar, usa primero lo que haya en caché (instantáneo
 *   y confiable) y dispara además una consulta de red en segundo plano.
 * - Esa consulta de red SOLO reemplaza el caché si trae datos; si vuelve
 *   vacía, se ignora en vez de "borrar" lo que ya sabíamos que existía.
 */
@Injectable({ providedIn: 'root' })
export class TorneoFlowCacheService {
  private readonly bloquesPorTorneo = new Map<string, Bloque[]>();
  private readonly combatesPorTorneo = new Map<string, Combate[]>();

  // ---------- Bloques ----------

  getBloques(torneoId: string): Bloque[] | undefined {
    return this.bloquesPorTorneo.get(torneoId);
  }

  setBloques(torneoId: string, bloques: Bloque[]): void {
    if (bloques.length === 0) return; // nunca sobrescribir con vacío
    this.bloquesPorTorneo.set(torneoId, bloques);
  }

  /** A diferencia de setBloques, esta sí permite guardar [] explícitamente (p. ej. tras borrar todo). */
  forceSetBloques(torneoId: string, bloques: Bloque[]): void {
    this.bloquesPorTorneo.set(torneoId, bloques);
  }

  // ---------- Combates ----------

  getCombates(torneoId: string): Combate[] | undefined {
    return this.combatesPorTorneo.get(torneoId);
  }

  setCombates(torneoId: string, combates: Combate[]): void {
    if (combates.length === 0) return;
    this.combatesPorTorneo.set(torneoId, combates);
  }

  /** Actualiza (o inserta) un combate puntual dentro del caché existente, sin perder el resto. */
  upsertCombate(torneoId: string, combate: Combate): void {
    const actuales = this.combatesPorTorneo.get(torneoId) ?? [];
    const idx = actuales.findIndex((c) => c._id === combate._id);
    if (idx >= 0) {
      actuales[idx] = combate;
    } else {
      actuales.push(combate);
    }
    this.combatesPorTorneo.set(torneoId, [...actuales]);
  }
}
