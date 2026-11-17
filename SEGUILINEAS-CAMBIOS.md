# Seguilineas — qué se integró sobre SumoMasters-main

Base: `SumoMasters-main` (desplegado). No se eliminó ningún archivo; solo se añadió/actualizó.

## Backend (CORE) — `src/seguilineas/`
Se tomó el backend de `SumoMasters-seguilineas-actualizado` (el más completo):
- Un solo registro por robot (mejor tiempo) con estado `VALIDO | DNF | DESCALIFICADO` y auditoría.
- Cola de turnos (`EN_ESPERA | SIGUIENTE | CORRIO`), reordenable.
- Finalizar torneo + podio fijo + desempate manual.
- Tiempo real por SSE (`GET /seguilineas/:id/stream`, `GET /seguilineas/stream/activo`).
- Migración automática al arrancar: torneos viejos con `categoria: 'seguilineas'` (string) pasan a ref `Categoria`;
  los datos viejos con `mejorTiempoMs` se siguen leyendo.

Correcciones añadidas:
- `editar`: ya no borra el podio guardado si el front reenvía el mismo estado; permite editar nombre/descripción
  de un torneo ya finalizado; el podio solo se limpia al reabrir un torneo finalizado.
- `quitarRobot`: sincroniza el podio si el torneo ya estaba finalizado.

## Frontend (FRONT)
Nuevo / reescrito para el contrato del backend nuevo:
- `core/models/seguilineas.model.ts`, `core/services/seguilineas.service.ts` (incluye `streamRanking` SSE + respaldo por polling 5 s).
- `features/seguilineas/seguilineas-panel.component.*` — staff: registrar tiempo / DNF / descalificar, editar, eliminar,
  cola de turnos, desempate, finalizar. Ruta pública `/live/seguilineas/:id` en solo-lectura y en vivo.
- `features/seguilineas/seguilineas-admin.component.*` — admin: crear/editar/eliminar torneos, staff, robots. Finalizar usa `POST :id/finalizar`.

Parches mínimos sobre archivos existentes de `main`:
- `app.routes.ts` (ruta `/seguilineas`), `sidebar.component.ts` (entrada de menú),
- `torneos.component.ts/.html` (crear Seguilineas redirige al módulo; se conserva el null-guard de `esTorneoRoboSoccer`),
- `live-combates.component.ts/.css` (ticker: últimos tiempos, top 3, posiciones, orden de salida),
- `torneos-publicos.component.ts/.html` (sección “Seguilineas”).

## Verificación hecha
- CORE: `tsc --noEmit` sin errores. FRONT: `ng build` (dev y prod) sin errores.
- Lógica de `ranking()` probada con datos simulados (orden, empates, DNF, podio fijo).
- NO probado contra MongoDB real ni con SSE detrás del proxy de producción.
