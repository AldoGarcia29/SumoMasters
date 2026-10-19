import { Injectable } from '@nestjs/common';

/**
 * Caché en memoria (sirve para un solo servidor/VPS).
 * Si luego usas Redis, solo cambia este archivo.
 */
@Injectable()
export class PublicCacheService {
  private cache = new Map<string, { data: unknown; expira: number }>();
  private enVuelo = new Map<string, Promise<unknown>>();

  /**
   * Devuelve lo cacheado o lo calcula UNA sola vez aunque lleguen 200 peticiones a la vez.
   * No cachea null/undefined (evita llenar memoria con ids inexistentes).
   */
  async wrap<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && hit.expira > Date.now()) return hit.data as T;

    const pendiente = this.enVuelo.get(key);
    if (pendiente) return pendiente as Promise<T>;

    const p = fn()
      .then((d) => {
        if (d !== null && d !== undefined) {
          this.cache.set(key, { data: d, expira: Date.now() + ttlMs });
        }
        return d;
      })
      .finally(() => this.enVuelo.delete(key));

    this.enVuelo.set(key, p);
    return p;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }
}
