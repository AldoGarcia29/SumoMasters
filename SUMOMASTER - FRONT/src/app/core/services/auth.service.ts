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
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
  ) {}

  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/login`, payload)
      .pipe(tap((response) => this.persistSession(response)));
  }

  register(payload: RegisterRequest): Observable<AuthResponse> {
    // A propósito NO se guarda la sesión aquí: después de registrarse,
    // el usuario debe iniciar sesión manualmente (no hay auto-login).
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, payload);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUserSignal.set(null);
    this.router.navigateByUrl('/auth/login');
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private persistSession(response: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, response.accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    this.currentUserSignal.set(response.user);
  }

  private readStoredUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  }
}
