import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthBrandingPanelComponent } from '../../../shared/components/auth-branding-panel/auth-branding-panel.component';
import { ApiErrorResponse } from '../../../core/models/auth.model';
import { AuthService } from '../../../core/services/auth.service';

/** Replica en el front las mismas reglas del RegisterDto del backend */
function usernamePattern(): RegExp {
  return /^[a-zA-Z0-9._-]+$/;
}

function passwordsMatchValidator(
  control: AbstractControl,
): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  if (!password || !confirmPassword) {
    return null;
  }

  return password === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    AuthBrandingPanelComponent,
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = this.fb.group(
    {
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      username: [
        '',
        [
          Validators.required,
          Validators.minLength(4),
          Validators.maxLength(30),
          Validators.pattern(usernamePattern()),
        ],
      ],
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(100)]],
      confirmPassword: ['', [Validators.required]],
      acceptTerms: [false, [Validators.requiredTrue]],
    },
    { validators: passwordsMatchValidator },
  );

  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly showTermsModal = signal(false);

  openTermsModal(): void {
    this.showTermsModal.set(true);
  }

  closeTermsModal(): void {
    this.showTermsModal.set(false);
  }

  acceptTermsFromModal(): void {
    this.form.controls.acceptTerms.setValue(true);
    this.showTermsModal.set(false);
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((value) => !value);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update((value) => !value);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.loading.set(true);

    const { name, email, username, password } = this.form.getRawValue();

    this.authService
      .register({ name: name!, email: email!, username: username!, password: password! })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () =>
          this.router.navigate(['/auth/login'], { queryParams: { registered: '1' } }),
        error: (err: HttpErrorResponse) => this.handleError(err),
      });
  }

  private handleError(err: HttpErrorResponse): void {
    const body = err.error as ApiErrorResponse | undefined;
    const message = Array.isArray(body?.message)
      ? body?.message.join(', ')
      : body?.message;

    this.errorMessage.set(
      message ?? 'No se pudo completar el registro. Intenta nuevamente.',
    );
  }
}
