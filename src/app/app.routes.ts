import { Routes } from '@angular/router';
import { DashboardLayout } from './layout/dashboard-layout/dashboard-layout';

export const routes: Routes = [
  {
    path: '',
    component: DashboardLayout,
    children: [
      {
        path: '',
        redirectTo: 'equipos',
        pathMatch: 'full',
      },
      {
        path: 'equipos',
        loadComponent: () =>
          import('./pages/equipos/equipos').then(
            (m) => m.Equipos,
          ),
      },
      {
        path: 'robots',
        loadComponent: () =>
          import('./pages/robots/robots').then(
            (m) => m.Robots,
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'equipos',
  },
];