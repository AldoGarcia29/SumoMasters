import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { Role } from './core/models/auth.model';

const SOLO_ADMIN = roleGuard([Role.ADMIN]);
const ADMIN_Y_STAFF = roleGuard([Role.ADMIN, Role.STAFF]);

export const routes: Routes = [
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
  { path: '', pathMatch: 'full', redirectTo: 'auth/login' },
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
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent,
      ),
  },
  {
    path: 'categorias',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/categorias/categorias.component').then(
        (m) => m.CategoriasComponent,
      ),
  },
  {
    path: 'equipos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/equipos/equipos.component').then(
        (m) => m.EquiposComponent,
      ),
  },
  {
    path: 'robots',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/robots/robots.component').then(
        (m) => m.RobotsComponent,
      ),
  },
  {
    path: 'torneos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/torneos/torneos.component').then(
        (m) => m.TorneosComponent,
      ),
  },
  {
    path: 'combates',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/combates-selector/combates-selector.component').then(
        (m) => m.CombatesSelectorComponent,
      ),
  },
  {
    path: 'dojos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dojos/dojos.component').then((m) => m.DojosComponent),
  },
  {
    path: 'reportes',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reportes-selector/reportes-selector.component').then(
        (m) => m.ReportesSelectorComponent,
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
      import('./features/torneo-enfrentamientos/torneo-enfrentamientos.component').then(
        (m) => m.TorneoEnfrentamientosComponent,
      ),
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
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/torneo-resultados/torneo-resultados.component').then(
        (m) => m.TorneoResultadosComponent,
      ),
  },
  {
    path: 'torneos/:id/ranking',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/torneo-ranking/torneo-ranking.component').then(
        (m) => m.TorneoRankingComponent,
      ),
  },
  {
    path: 'torneos/:id/historial',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/torneo-historial/torneo-historial.component').then(
        (m) => m.TorneoHistorialComponent,
      ),
  },
  {
    path: 'torneos/:id/reportes',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/torneo-reportes/torneo-reportes.component').then(
        (m) => m.TorneoReportesComponent,
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
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/configuracion/configuracion.component').then(
        (m) => m.ConfiguracionComponent,
      ),
  },
  { path: '**', redirectTo: 'auth/login' },
];
