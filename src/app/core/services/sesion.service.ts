import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { UsuarioSesion } from '../interfaces/usuario.interface';

@Injectable({
  providedIn: 'root',
})
export class SesionService {
  private readonly http = inject(HttpClient);

  private readonly usuarioSignal = signal<UsuarioSesion | null>(null);

  readonly usuario = this.usuarioSignal.asReadonly();

  readonly nombreUsuario = computed(
    () => this.usuarioSignal()?.nombre ?? '',
  );

  cargarPerfil(): void {
    const token = localStorage.getItem('token');

    if (!token) {
      return;
    }

    this.http
      .get<UsuarioSesion>('http://localhost:3000/auth/perfil')
      .subscribe({
        next: (usuario) => {
          this.usuarioSignal.set(usuario);
        },
        error: () => {
          this.usuarioSignal.set(null);
        },
      });
  }

  establecerUsuario(usuario: UsuarioSesion): void {
    this.usuarioSignal.set(usuario);
  }

  cerrarSesion(): void {
    localStorage.removeItem('token');
    this.usuarioSignal.set(null);
  }
}