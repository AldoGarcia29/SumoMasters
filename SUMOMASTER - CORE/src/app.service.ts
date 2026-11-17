import { Injectable } from '@nestjs/common';

/**
 * Se actualiza cada vez que se entrega una corrección importante, para poder
 * verificar en /api/health qué versión del código está corriendo realmente
 * el servidor — muy útil para detectar cuando un proceso viejo quedó
 * corriendo en el puerto y por eso los cambios "no se ven".
 */
const BUILD_TAG = '2026-08-05-bloques-fix-3';

@Injectable()
export class AppService {
  health() {
    return { status: 'ok', service: 'sumomaster-core', build: BUILD_TAG };
  }
}
