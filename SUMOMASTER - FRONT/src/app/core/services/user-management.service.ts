import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthUser, Role } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class UserManagementService {
  private readonly apiUrl = `${environment.apiUrl}/users`;

  constructor(private readonly http: HttpClient) {}

  findAll(): Observable<AuthUser[]> {
    return this.http.get<AuthUser[]>(this.apiUrl);
  }

  updateRoles(id: string, roles: Role[]): Observable<AuthUser> {
    return this.http.patch<AuthUser>(`${this.apiUrl}/${id}/roles`, { roles });
  }

  activate(id: string): Observable<AuthUser> {
    return this.http.patch<AuthUser>(`${this.apiUrl}/${id}/activate`, {});
  }

  deactivate(id: string): Observable<AuthUser> {
    return this.http.patch<AuthUser>(`${this.apiUrl}/${id}/deactivate`, {});
  }
}
