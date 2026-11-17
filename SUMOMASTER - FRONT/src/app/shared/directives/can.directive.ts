import {
  Directive,
  Input,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

export type Permission = 'manage' | 'admin';

@Directive({
  selector: '[appCan]',
  standalone: true,
})
export class CanDirective {
  private readonly auth = inject(AuthService);
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);

  private readonly permission = signal<Permission | null>(null);
  private hasView = false;

  @Input({ required: true })
  set appCan(value: Permission) {
    this.permission.set(value);
  }

  constructor() {
    effect(() => {
      const permission = this.permission();

      const allowed =
        permission === 'admin'
          ? this.auth.isAdmin()
          : permission === 'manage'
            ? this.auth.canManage()
            : false;

      if (allowed && !this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
      } else if (!allowed && this.hasView) {
        this.viewContainer.clear();
        this.hasView = false;
      }
    });
  }
}