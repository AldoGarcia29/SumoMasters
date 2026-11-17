import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-auth-branding-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './auth-branding-panel.component.html',
  styleUrl: './auth-branding-panel.component.scss',
})
export class AuthBrandingPanelComponent {
  readonly features = [
    {
      icon: 'trophy',
      title: 'Torneos',
      description: 'Organiza y gestiona tus torneos',
    },
    {
      icon: 'users',
      title: 'Equipos',
      description: 'Registra equipos y robots',
    },
    {
      icon: 'chart',
      title: 'Rankings',
      description: 'Consulta resultados en tiempo real',
    },
  ];
}
