import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { TorneoClasificadosComponent } from './features/torneo-clasificados/torneo-clasificados.component';
import { roleGuard } from './core/guards/role.guard';
import { Role } from './core/models/auth.model';

const SOLO_ADMIN = roleGuard([Role.ADMIN]);
const ADMIN_Y_STAFF = roleGuard([Role.ADMIN, Role.STAFF]);

export const routes: Routes = [
  // =========================
  // RUTAS PÚBLICAS
  // =========================

  {
    path: 'live',
    loadComponent: () =>
      import('./public/torneos-publicos/torneos-publicos.component').then(
        (m) => m.TorneosPublicosComponent,
      ),
  },

  {
    path: 'live/:id',
    loadComponent: () =>
      import('./public/live-torneo/live-torneo.component').then(
        (m) => m.LiveTorneoComponent,
      ),
  },

  {
    path: 'versus/:id',
    loadComponent: () =>
      import('./public/versus/versus.component').then(
        (m) => m.VersusComponent,
      ),
  },

  // =========================
  // RUTA INICIAL
  // =========================

  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'auth/login',
  },

  // =========================
  // AUTENTICACIÓN
  // =========================

  {
    path: 'auth/login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then(
        (m) => m.LoginComponent,
      ),
  },

  {
    path: 'auth/register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/register/register.component').then(
        (m) => m.RegisterComponent,
      ),
  },

  // =========================
  // SOLO ADMIN
  // =========================

  {
    path: 'dashboard',
    canActivate: [authGuard, SOLO_ADMIN],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent,
      ),
  },

  {
    path: 'categorias',
    canActivate: [authGuard, SOLO_ADMIN],
    loadComponent: () =>
      import('./features/categorias/categorias.component').then(
        (m) => m.CategoriasComponent,
      ),
  },

  {
    path: 'equipos',
    canActivate: [authGuard, SOLO_ADMIN],
    loadComponent: () =>
      import('./features/equipos/equipos.component').then(
        (m) => m.EquiposComponent,
      ),
  },

  {
    path: 'robots',
    canActivate: [authGuard, SOLO_ADMIN],
    loadComponent: () =>
      import('./features/robots/robots.component').then(
        (m) => m.RobotsComponent,
      ),
  },

  {
    path: 'dojos',
    canActivate: [authGuard, SOLO_ADMIN],
    loadComponent: () =>
      import('./features/dojos/dojos.component').then(
        (m) => m.DojosComponent,
      ),
  },

  {
    path: 'reportes',
    canActivate: [authGuard, SOLO_ADMIN],
    loadComponent: () =>
      import('./features/reportes-selector/reportes-selector.component').then(
        (m) => m.ReportesSelectorComponent,
      ),
  },

  {
    path: 'usuarios',
    canActivate: [authGuard, SOLO_ADMIN],
    loadComponent: () =>
      import('./features/usuarios/usuarios.component').then(
        (m) => m.UsuariosComponent,
      ),
  },

  {
    path: 'configuracion',
    canActivate: [authGuard, SOLO_ADMIN],
    loadComponent: () =>
      import('./features/configuracion/configuracion.component').then(
        (m) => m.ConfiguracionComponent,
      ),
  },

  // =========================
  // ADMIN Y STAFF
  // =========================

  {
    path: 'torneos',
    canActivate: [authGuard, ADMIN_Y_STAFF],
    loadComponent: () =>
      import('./features/torneos/torneos.component').then(
        (m) => m.TorneosComponent,
      ),
  },

  {
    path: 'combates',
    canActivate: [authGuard, ADMIN_Y_STAFF],
    loadComponent: () =>
      import('./features/combates-selector/combates-selector.component').then(
        (m) => m.CombatesSelectorComponent,
      ),
  },

  {
    path: 'torneos/:id/bloques',
    canActivate: [authGuard, ADMIN_Y_STAFF],
    loadComponent: () =>
      import('./features/torneo-bloques/torneo-bloques.component').then(
        (m) => m.TorneoBloquesComponent,
      ),
  },

  {
    path: 'torneos/:id/enfrentamientos',
    canActivate: [authGuard, ADMIN_Y_STAFF],
    loadComponent: () =>
      import(
        './features/torneo-enfrentamientos/torneo-enfrentamientos.component'
      ).then((m) => m.TorneoEnfrentamientosComponent),
  },

  {
    path: 'torneos/:id/dojos',
    canActivate: [authGuard, ADMIN_Y_STAFF],
    loadComponent: () =>
      import('./features/torneo-dojos/torneo-dojos.component').then(
        (m) => m.TorneoDojosComponent,
      ),
  },

  {
    path: 'torneos/:id/resultados',
    canActivate: [authGuard, ADMIN_Y_STAFF],
    loadComponent: () =>
      import('./features/torneo-resultados/torneo-resultados.component').then(
        (m) => m.TorneoResultadosComponent,
      ),
  },

  {
    path: 'torneos/:id/ranking',
    canActivate: [authGuard, ADMIN_Y_STAFF],
    loadComponent: () =>
      import('./features/torneo-ranking/torneo-ranking.component').then(
        (m) => m.TorneoRankingComponent,
      ),
  },

  {
    path: 'torneos/:id/historial',
    canActivate: [authGuard, ADMIN_Y_STAFF],
    loadComponent: () =>
      import('./features/torneo-historial/torneo-historial.component').then(
        (m) => m.TorneoHistorialComponent,
      ),
  },

  {
    path: 'torneos/:id/control-versus',
    canActivate: [authGuard, ADMIN_Y_STAFF],
    loadComponent: () =>
      import('./features/control-versus/control-versus.component').then(
        (m) => m.ControlVersusComponent,
      ),
  },

  {
    path: 'torneos/:id/clasificados',
    canActivate: [authGuard, ADMIN_Y_STAFF],
    component: TorneoClasificadosComponent,
  },

  {
    path: 'torneos/:id/podio',
    canActivate: [authGuard, ADMIN_Y_STAFF],
    loadComponent: () =>
      import('./features/torneo-podio/torneo-podio.component').then(
        (m) => m.TorneoPodioComponent,
      ),
  },

  // =========================
  // REPORTES POR TORNEO
  // SOLO ADMIN
  // =========================

  {
    path: 'torneos/:id/reportes',
    canActivate: [authGuard, SOLO_ADMIN],
    loadComponent: () =>
      import('./features/torneo-reportes/torneo-reportes.component').then(
        (m) => m.TorneoReportesComponent,
      ),
  },

  // =========================
  // CUALQUIER RUTA DESCONOCIDA
  // =========================

  {
    path: '**',
    redirectTo: 'auth/login',
  },
];