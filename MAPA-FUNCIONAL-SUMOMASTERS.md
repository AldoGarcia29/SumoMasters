# Mapa funcional de SumoMasters

Guía de contexto para personas y asistentes de IA que vayan a analizar o modificar el sistema. Describe el comportamiento que se observa en el código del frontend; no sustituye la validación de las APIs ni las pruebas en ejecución.

## Resumen del producto

SumoMasters administra torneos de robots y publica información para el evento. Sus flujos principales son:

1. Preparar categorías, participantes, torneos, fases, dojos y combates.
2. Operar los combates y registrar resultados con acceso de administrador o staff.
3. Configurar pantallas y mostrar el torneo en vivo.
4. Consultar páginas públicas de torneos, combates y Seguilineas.

El repositorio separa la aplicación en tres proyectos:

| Proyecto | Responsabilidad |
|---|---|
| `SUMOMASTER - FRONT` | Interfaz web Angular. |
| `SUMOMASTER - AUTH` | API de autenticación y usuarios. |
| `SUMOMASTER - CORE` | API y reglas del dominio de torneos, combates y datos públicos. |

## Roles y accesos

### Administrador

Tiene acceso a la administración general: Dashboard, Torneos, Equipos, Robots, Categorías, Combates, Combate extra, Dojos, Reportes, Usuarios y Configuración. También puede usar Control de pantallas y Seguilineas.

### Staff

El menú ofrece Registrar resultados, Control de pantallas y Seguilineas. El staff entra primero a `/staff/resultados`, selecciona un torneo/asignación y opera los combates de sus dojos asignados. La pantalla de resultados ofrece una vista simplificada para staff y restringe las acciones según la asignación.

### Público

Las rutas de consulta en vivo no requieren iniciar sesión: `/live`, `/live/:id`, `/live/:id/combates`, `/versus/:id` y `/live/seguilineas/:id`.

Las rutas y guards son la referencia final de acceso; no asumir permisos por la sola presencia u ocultamiento de un botón.

## Torneos: qué hace cada acción del listado

La pantalla `/torneos` está protegida para **ADMIN**. En la tabla se muestran nombre, fecha, categoría, estado y número de participantes (robots o equipos, según el tipo de torneo). Hay filtros por todos, en progreso, programados y finalizados; la lista pagina los resultados.

| Control visible | Comportamiento actual | Acceso/observación |
|---|---|---|
| **Ingresar** | Abre la pantalla de operación y resultados del torneo en `/torneos/:id/resultados`. Para una categoría Seguilineas navega a `/seguilineas`. | El template lo marca para `manage` (ADMIN y STAFF), pero la ruta `/torneos` que contiene la tabla está protegida solo para ADMIN. El staff tiene su propia entrada en `/staff/resultados`. |
| **Cuatro cuadros** | Abre la preparación/gestión de fases. Torneos normales: `/torneos/:id/bloques`; Robo Soccer RC: `/torneos/:id/grupos`; Seguilineas: `/seguilineas`. | Solo ADMIN. No abre la pantalla de registro de resultados. |
| **Lápiz** | Abre el formulario de edición del torneo. En Seguilineas redirige al módulo `/seguilineas`. | Solo ADMIN. |
| **Ojo** | Abre un modal de consulta de los datos del torneo y sus participantes. | El listado es solo ADMIN. |
| **Papelera** | Solicita confirmación para eliminar el torneo. | Solo ADMIN; confirmar la eliminación produce un cambio destructivo. |

### ¿Se debe borrar “Ingresar”?

**No conviene borrarlo por el motivo de que sea “la vista de staff”.** Su función real es ser un acceso rápido a la operación/resultados, pantalla que también usa ADMIN. El staff tiene además su propio flujo de selección en `/staff/resultados` y, desde ahí, accede al mismo módulo de resultados en el contexto de su asignación.

El ícono de cuatro cuadros tiene una función distinta: gestionar bloques o grupos/fases. No es el botón principal para capturar resultados.

Sí hay una mejora potencial por decidir: para una fila Seguilineas, **Ingresar** y **cuatro cuadros** terminan actualmente en `/seguilineas`, por lo que parecen duplicados. No eliminar ni cambiar ese acceso sin definir cuál acción se quiere mantener para esa categoría.

> Nota de interfaz: el comentario del template indica que Ingresar admite ADMIN y STAFF, pero la propia lista `/torneos` solo permite ADMIN. El flujo real del staff es `/staff/resultados`. Si la intención de producto es que el staff navegue el listado general de torneos, habría que cambiar permisos/ruta y diseñar sus acciones por separado; hoy no es así.

## Funcionalidades por área

### Administración de torneo

- Crear un torneo y asignar categoría, fecha, descripción, estado y participantes.
- Usar robots inscritos para torneos de sumo; usar equipos para Robo Soccer RC.
- Editar, consultar y eliminar torneos.
- Administrar bloques/fases, enfrentamientos, dojos, rankings, historial, clasificados, podio y reportes desde rutas dedicadas.
- Robo Soccer tiene áreas propias de grupos, resultados de grupos y llaves.

### Combates y resultados

- Consultar y operar combates separados por torneo, estado y asignación de dojo/arena.
- Iniciar combates y registrar el resultado/ganador y método de victoria.
- STAFF opera sus dojos asignados y ve una pantalla compacta; ADMIN dispone de acciones adicionales, como asignaciones, datos de prueba, ranking o avanzar de fase cuando aplica.
- La pantalla de selección de staff es `/staff/resultados`; la operación está en `/torneos/:id/resultados`.

### Control de pantallas

Ruta administrativa/staff: `/pantallas`.

- Seleccionar un torneo y ajustar la cantidad de dojos activos (dentro de los disponibles).
- Abrir o copiar enlaces de tres destinos: pantalla principal (`/versus/principal?torneo=:id`), programa público (`/live/:id/combates`) y control desde celular (`/torneos/:id/control-versus`).
- El control desde celular muestra los combates simultáneos, permite priorizar uno para la pantalla principal y modificar los dojos activos.
- La vista pública de combates se actualiza periódicamente y ofrece filtros de torneo/fase/ronda, búsqueda y paginación.
- En modo proyección se puede escoger Arena, Bloques/Grupos, Robo Soccer o Pantallas configuradas. También se puede elegir los dojos para la vista de arena.
- La vista de Pantallas configuradas muestra el lote vigente y los combates que siguen.
- El programa público incluye una barra de patrocinadores/resultados de Seguilineas.

### Seguilineas

- Módulo disponible para ADMIN y STAFF desde `/seguilineas`.
- Tiene una pantalla de administración/operación y una página pública de lectura en `/live/seguilineas/:id`.
- Sus datos alimentan la barra pública inferior de patrocinadores y resultados recientes.
- En el listado de torneos, si la categoría se reconoce como Seguilineas, los accesos del torneo se enrutan al módulo Seguilineas, no a las pantallas convencionales de bloques/resultados.

### Catálogos y administración

Rutas de administración (ADMIN): Dashboard, Equipos, Robots, Categorías, Dojos, Combates, Combate extra, Reportes, Usuarios y Configuración. Confirmar siempre las rutas y sus guards antes de asumir acceso por rol.

## Rutas clave

| Ruta | Uso |
|---|---|
| `/torneos` | Listado y administración de torneos (ADMIN). |
| `/torneos/:id/resultados` | Operación de combates y resultados (ADMIN/STAFF, con restricciones de asignación para staff). |
| `/staff/resultados` | Selector/entrada de staff para torneos y asignaciones vigentes. |
| `/torneos/:id/bloques` | Preparar bloques/fases de torneos normales (ADMIN). |
| `/torneos/:id/grupos` | Gestión de grupos para Robo Soccer RC (ADMIN). |
| `/pantallas` | Configurar salidas y dojos activos (ADMIN/STAFF). |
| `/torneos/:id/control-versus` | Control móvil del combate destacado y lote de pantallas (ADMIN/STAFF). |
| `/live/:id/combates` | Programa público y modos de proyección. |
| `/versus/principal?torneo=:id` | Pantalla pública del combate priorizado. |

## Orientación para futuras tareas de IA

- Leer este mapa como contexto inicial y confirmar el comportamiento en los archivos fuente antes de editar.
- Mantener separado el flujo **preparar fases** del flujo **operar combates/resultados**.
- Revisar guards/rutas y directivas de permisos juntos: el menú, el acceso a la ruta y los controles visibles pueden tener reglas distintas.
- Para cambios en acciones de torneo, probar al menos un torneo normal, uno Robo Soccer RC y uno Seguilineas.
- Preservar el acceso de ADMIN y el flujo dedicado del STAFF; no asumir que un botón es redundante por su etiqueta o icono.
- Ejecutar la validación adecuada del proyecto afectado; para el frontend, `npx ng build` desde `SUMOMASTER - FRONT`.

## Fuentes principales

- `SUMOMASTER - FRONT/src/app/features/torneos/torneos.component.html`
- `SUMOMASTER - FRONT/src/app/features/torneos/torneos.component.ts`
- `SUMOMASTER - FRONT/src/app/app.routes.ts`
- `SUMOMASTER - FRONT/src/app/shared/components/sidebar/sidebar.component.ts`
- `SUMOMASTER - FRONT/src/app/features/staff-resultados/staff-resultados.component.ts`
- `SUMOMASTER - FRONT/src/app/features/torneo-resultados/torneo-resultados.component.ts`
- `SUMOMASTER - FRONT/src/app/features/control-pantallas/control-pantallas.component.ts`
- `SUMOMASTER - FRONT/src/app/features/control-versus/control-versus.component.ts`
- `SUMOMASTER - FRONT/src/app/public/live-combates/live-combates.component.ts`
- `SUMOMASTER - FRONT/src/app/public/live-combates/live-combates.component.html`
