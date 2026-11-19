import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RobotFichaModalComponent } from './shared/components/robot-ficha-modal/robot-ficha-modal.component';
import { ButtonComponent } from './shared/components/button/button.component';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RobotFichaModalComponent, ButtonComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  readonly navigationLoading = signal(false);
  readonly sessionInvalid = this.authService.sessionInvalid;

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.navigationLoading.set(true);
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.navigationLoading.set(false);
      }
    });
  }

  returnToLogin(): void {
    this.authService.logout();
  }

  dismissSessionNotice(): void {
    this.authService.dismissSessionInvalid();
  }

  title = 'sumo-masters-front';
}
