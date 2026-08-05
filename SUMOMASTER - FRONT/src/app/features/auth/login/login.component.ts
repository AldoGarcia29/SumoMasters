import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthBrandingPanelComponent } from '../../../shared/components/auth-branding-panel/auth-branding-panel.component';
import { ApiErrorResponse } from '../../../core/models/auth.model';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    AuthBrandingPanelComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly form = this.fb.group({
    identifier: ['', [Validators.required]],
    password: ['', [Validators.required]],
    remember: [false],
  });

  readonly showPassword = signal(false);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly justRegistered = signal(
    this.route.snapshot.queryParamMap.get('registered') === '1',
  );

  togglePasswordVisibility(): void {
    this.showPassword.update((value) => !value);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.justRegistered.set(false);
    this.loading.set(true);

    const { identifier, password } = this.form.getRawValue();

    this.authService
      .login({ identifier: identifier!, password: password! })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => this.router.navigateByUrl('/dashboard'),
        error: (err: HttpErrorResponse) => this.handleError(err),
      });
  }

  private handleError(err: HttpErrorResponse): void {
    const body = err.error as ApiErrorResponse | undefined;
    const message = Array.isArray(body?.message)
      ? body?.message.join(', ')
      : body?.message;

    this.errorMessage.set(
      message ?? 'No se pudo iniciar sesión. Intenta nuevamente.',
    );
  }
}
