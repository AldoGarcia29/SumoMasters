/**
 * NestJS (class-validator) puede responder `message` como string o como
 * arreglo de strings (uno por cada regla de validación que falló).
 * Esta función normaliza ambos casos a un solo string legible.
 */
export function extractErrorMessage(err: unknown, fallback: string): string {
  const httpError = err as {
    status?: number;
    statusText?: string;
    error?: { message?: string | string[]; error?: string; statusCode?: number };
    message?: string;
  };

  const message = httpError?.error?.message;

  if (Array.isArray(message)) {
    return message.join(' · ');
  }

  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  // Si no hay body JSON con `message` (p. ej. error de red, CORS, o el
  // servidor no respondió en absoluto), mostramos lo más específico que
  // tengamos disponible en vez de un fallback genérico que oculta la causa.
  if (httpError?.status === 0) {
    return `No se pudo contactar al servidor (¿está corriendo? ¿CORS?). ${fallback}`;
  }

  if (httpError?.status) {
    const detalle = httpError.error?.error || httpError.statusText || '';
    return `Error ${httpError.status}${detalle ? ` (${detalle})` : ''}: ${fallback}`;
  }

  return fallback;
}
