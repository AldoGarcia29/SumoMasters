# SumoMasters — resumen ejecutivo

## ¿Qué hace?

Aplicación para administrar torneos de sumo robótico: equipos, robots, categorías, dojos, combates, resultados, rankings y vistas públicas de torneos. Hay acceso con usuarios y roles (admin/staff).

## Cómo está organizado

La raíz contiene **tres proyectos independientes** (cada uno tiene su propio `package.json`):

| Carpeta | Función |
| --- | --- |
| `SUMOMASTER - FRONT` | Interfaz web en Angular 18. `src/app/features` contiene las pantallas de administración; `public` las páginas públicas; `core` servicios, modelos, guards e interceptor; `shared` componentes y estilos comunes. |
| `SUMOMASTER - AUTH` | API NestJS 11 para registro, inicio de sesión y usuarios. Emite JWT y administra roles. |
| `SUMOMASTER - CORE` | API NestJS 11 con las reglas y datos del dominio: torneos, equipos, robots, categorías, dojos, bloques, combates, ranking y consultas públicas. |

Los backends exponen sus rutas bajo `/api`. La interfaz local usa `http://localhost:8081/api` para Auth y `http://localhost:8082/api` para Core.

## Datos y configuración

- **Base de datos:** MongoDB, accedida mediante Mongoose. No hay SQL. Las dos APIs requieren `MONGODB_URI`; el nombre de la base es el segmento final de esa URI. MongoDB crea la base/colecciones al empezar a guardar datos.
- **Autenticación:** JWT. `AUTH` firma tokens y `CORE` los valida; configura el mismo `JWT_SECRET` en ambas APIs.
- No encontré archivos `.env` en el proyecto. Crea uno dentro de cada carpeta backend (no compartas ni publiques secretos):

```env
# SUMOMASTER - AUTH/.env
MONGODB_URI=mongodb://127.0.0.1:27017/sumomasters
JWT_SECRET=reemplaza-por-un-secreto-local
JWT_EXPIRATION=1d
PORT=8081
```

```env
# SUMOMASTER - CORE/.env
MONGODB_URI=mongodb://127.0.0.1:27017/sumomasters
JWT_SECRET=reemplaza-por-un-secreto-local
PORT=8082
```

Usa MongoDB local iniciado, o sustituye ambas URI por una URI de Atlas. Si usas Compass, conecta con la misma URI; abre la base `sumomasters` y revisa sus colecciones después de registrar o guardar datos. También puedes consultar desde `mongosh`:

```text
mongosh "mongodb://127.0.0.1:27017/sumomasters"
show collections
db.usuarios.find().limit(5)
```

## Ejecutar localmente (tres terminales)

Requiere Node.js/npm y una instancia accesible de MongoDB. Ejecuta cada bloque desde la raíz del repositorio:

```powershell
cd "SUMOMASTER - AUTH"
npm install
npm run start:dev
```

```powershell
cd "SUMOMASTER - CORE"
npm install
npm run start:dev
```

```powershell
cd "SUMOMASTER - FRONT"
npm install
npm start
```

Abre **http://localhost:4200**. Verifica que las APIs arrancaron sin errores de conexión a MongoDB en sus terminales. La ruta de comprobación del Core es **http://localhost:8082/api/health**.

## Datos útiles

- Scripts habituales de los backends: `npm run build`, `npm test`; el frontend: `npm run build`, `npm test`.
- Frontend local: `src/environments/environment.ts`; URLs de despliegue: `environment.prod.ts`.
- Los ZIP de la raíz son copias empaquetadas; para desarrollar, usa las carpetas sin comprimir.
