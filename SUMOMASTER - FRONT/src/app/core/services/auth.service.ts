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

interface JwtClaims {
  sub: string;
  exp: number;
  roles: Role[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  private readonly currentUserSignal = signal<AuthUser | null>(this.readStoredUser());

  readonly currentUser = this.currentUserSignal.asReadonly();

  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);

  /** ADMIN: puede todo, incluida la eliminación y la gestión de usuarios. */
  readonly isAdmin = computed(() => this.hasAnyRole([Role.ADMIN]));

  /** ADMIN o STAFF: puede crear, editar y operar torneos/combates (no eliminar). */
  readonly canManage = computed(() => this.hasAnyRole([Role.ADMIN, Role.STAFF]));

  hasAnyRole(roles: readonly Role[]): boolean {
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
  ) {}

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

  hasValidSession(): boolean {
    const user = this.currentUserSignal();
    const token = this.readStoredToken();
    const claims = token ? this.readTokenClaims(token) : null;
    const valid =
      !!user &&
      !!claims &&
      claims.sub === user.id &&
      claims.exp * 1000 > Date.now();

    if (!valid) {
      this.clearStoredSession();
      this.currentUserSignal.set(null);
    }

    return valid;
  }

  logout(): void {
    this.clearStoredSession();
    this.currentUserSignal.set(null);

    void this.router.navigateByUrl('/auth/login', {
      replaceUrl: true,
    });
  }

  getToken(): string | null {
    return this.hasValidSession() ? this.readStoredToken() : null;
  }

  private persistSession(response: AuthResponse): void {
    this.clearStoredSession();
    localStorage.setItem(TOKEN_KEY, response.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    this.currentUserSignal.set(response.user);
  }

  private readStoredUser(): AuthUser | null {
    const storage = [localStorage, sessionStorage].find(
      (candidate) =>
        candidate.getItem(TOKEN_KEY) && candidate.getItem(USER_KEY),
    );

    if (!storage) {
      this.clearStoredSession();
      return null;
    }

    const token = storage.getItem(TOKEN_KEY);
    const rawUser = storage.getItem(USER_KEY);
    const claims = token ? this.readTokenClaims(token) : null;

    if (!claims || claims.exp * 1000 <= Date.now() || !rawUser) {
      this.clearStoredSession();
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(rawUser);
      if (!this.isStoredUser(parsed) || parsed.id !== claims.sub) {
        this.clearStoredSession();
        return null;
      }

      return { ...parsed, roles: claims.roles };
    } catch {
      this.clearStoredSession();
      return null;
    }
  }

  private readStoredToken(): string | null {
    return (
      localStorage.getItem(TOKEN_KEY) ??
      sessionStorage.getItem(TOKEN_KEY)
    );
  }

  private readTokenClaims(token: string): JwtClaims | null {
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3 || tokenParts.some((part) => !part)) return null;

      const encodedPayload = tokenParts[1];
      const base64 = encodedPayload
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      const payload: unknown = JSON.parse(
        atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')),
      );
      if (
        typeof payload !== 'object' ||
        payload === null ||
        !('sub' in payload) ||
        !('exp' in payload) ||
        !('roles' in payload) ||
        typeof payload.sub !== 'string' ||
        typeof payload.exp !== 'number' ||
        !Number.isFinite(payload.exp) ||
        !Array.isArray(payload.roles) ||
        !payload.roles.every((role: unknown) =>
          Object.values(Role).some((validRole) => validRole === role),
        )
      ) {
        return null;
      }

      return {
        sub: payload.sub,
        exp: payload.exp,
        roles: payload.roles,
      };
    } catch {
      return null;
    }
  }

  private isStoredUser(value: unknown): value is AuthUser {
    if (typeof value !== 'object' || value === null) return false;

    return (
      'id' in value &&
      typeof value.id === 'string' &&
      'name' in value &&
      typeof value.name === 'string' &&
      'email' in value &&
      typeof value.email === 'string' &&
      'username' in value &&
      typeof value.username === 'string' &&
      'active' in value &&
      value.active === true &&
      'roles' in value &&
      Array.isArray(value.roles)
    );
  }

  private clearStoredSession(): void {
    for (const storage of [localStorage, sessionStorage]) {
      storage.removeItem(TOKEN_KEY);
      storage.removeItem(USER_KEY);
    }
  }
}