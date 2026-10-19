import { Directive, Input, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

/**
 * Permisos de la interfaz (reflejan los @Roles del backend):
 *  - 'manage': ADMIN o STAFF  -> crear, editar, generar, asignar, registrar resultados.
 *  - 'admin' : solo ADMIN     -> eliminar y gestionar usuarios.
 *
 * Uso: <button *appCan="'manage'">Editar</button>
 *
 * Esto es solo experiencia de usuario: la seguridad real la aplica el backend.
 */
export type Permission = 'manage' | 'admin';

@Directive({
  selector: '[appCan]',
  standalone: true,
})
export class CanDirective {
  private readonly auth = inject(AuthService);
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);

  private hasView = false;

  @Input({ required: true })
  set appCan(permission: Permission) {
    const allowed =
      permission === 'admin' ? this.auth.isAdmin() : this.auth.canManage();

    if (allowed && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!allowed && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}
