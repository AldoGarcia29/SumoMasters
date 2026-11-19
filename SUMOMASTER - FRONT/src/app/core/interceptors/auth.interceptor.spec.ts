import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';
import { environment } from '../../../environments/environment';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpTestingController: HttpTestingController;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'getToken',
      'isTokenExpired',
      'logout',
      'logoutForInvalidSession',
      'markSessionInvalid',
    ]);
    authService.getToken.and.returnValue('test-token');
    authService.isTokenExpired.and.returnValue(false);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authService },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('shows a session warning for an authenticated protected CORE 401', () => {
    http.get(`${environment.coreApiUrl}/torneos`).subscribe({
      error: () => undefined,
    });

    httpTestingController.expectOne(`${environment.coreApiUrl}/torneos`).flush(
      {},
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(authService.markSessionInvalid).toHaveBeenCalled();
    expect(authService.logout).not.toHaveBeenCalled();
  });

  it('shows a session warning when a protected CORE request has no token', () => {
    authService.getToken.and.returnValue(null);

    http.get(`${environment.coreApiUrl}/torneos`).subscribe({
      error: () => undefined,
    });

    httpTestingController.expectOne(`${environment.coreApiUrl}/torneos`).flush(
      {},
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(authService.markSessionInvalid).toHaveBeenCalled();
    expect(authService.logout).not.toHaveBeenCalled();
  });

  it('clears an expired CORE session and keeps the sign-in notice visible', () => {
    authService.isTokenExpired.and.returnValue(true);

    http.get(`${environment.coreApiUrl}/torneos`).subscribe({
      error: () => undefined,
    });

    httpTestingController.expectOne(`${environment.coreApiUrl}/torneos`).flush(
      {},
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(authService.logoutForInvalidSession).toHaveBeenCalled();
    expect(authService.markSessionInvalid).not.toHaveBeenCalled();
  });

  it('does not show a session warning for a public CORE 401', () => {
    http.get(`${environment.coreApiUrl}/public/torneos`).subscribe({
      error: () => undefined,
    });

    httpTestingController
      .expectOne(`${environment.coreApiUrl}/public/torneos`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(authService.markSessionInvalid).not.toHaveBeenCalled();
    expect(authService.logout).not.toHaveBeenCalled();
  });

  it('preserves automatic logout for an auth API 401', () => {
    http.get('http://localhost:8081/api/auth/profile').subscribe({
      error: () => undefined,
    });

    httpTestingController
      .expectOne('http://localhost:8081/api/auth/profile')
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(authService.logout).toHaveBeenCalled();
    expect(authService.markSessionInvalid).not.toHaveBeenCalled();
  });
});
