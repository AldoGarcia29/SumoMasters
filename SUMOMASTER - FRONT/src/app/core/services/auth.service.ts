import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuthResponse,
  AuthUser,
  LoginRequest,
  RegisterRequest,
  Role,
} from '../models/auth.model';

const TOKEN_KEY = 'sumo_masters_token';
const USER_KEY = 'sumo_masters_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  private readonly currentUserSignal = signal<AuthUser | null>(
  this.readStoredUser(),
);

  readonly currentUser = this.currentUserSignal.asReadonly();

  readonly isAuthenticated = computed(
    () => this.currentUserSignal() !== null,
  );

  /** ADMIN: puede todo, incluida la eliminación y la gestión de usuarios. */
  readonly isAdmin = computed(() => this.hasAnyRole([Role.ADMIN]));

  /** ADMIN o STAFF: puede crear, editar y operar torneos/combates (no eliminar). */
  readonly canManage = computed(() => this.hasAnyRole([Role.ADMIN, Role.STAFF]));

  hasAnyRole(roles: Role[]): boolean {
    const userRoles = this.currentUserSignal()?.roles ?? [];
    return roles.some((role) => userRoles.includes(role));
  }

  /** Página de inicio según el rol (evita bucles de redirección en los guards). */
  homeRoute(): string {
    if (this.hasAnyRole([Role.ADMIN])) return '/dashboard';
    if (this.hasAnyRole([Role.STAFF])) return '/staff/resultados';
    return '/live';
  }

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
  ) {
  }

  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/login`, payload)
      .pipe(
        tap((response) => this.persistSession(response)),
      );
  }

  register(payload: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(
      `${this.apiUrl}/register`,
      payload,
    );
  }

  private readStoredUser(): AuthUser | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const rawUser = localStorage.getItem(USER_KEY);

  if (!token || !rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser) as AuthUser;
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

  logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  this.currentUserSignal.set(null);

  void this.router.navigateByUrl('/auth/login', {
    replaceUrl: true,
  });
}

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private persistSession(response: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, response.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    this.currentUserSignal.set(response.user);
  }
}