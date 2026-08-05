import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationsService } from '../../../core/services/notifications.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly notificationsService = inject(NotificationsService);

  @Input() title = '';
  @Input() subtitle = '';
  /** @deprecated el contador ahora se calcula solo a partir de la actividad real */
  @Input() notificationCount = 0;

  /** Se emite al tocar el botón de menú (solo visible en mobile/tablet) */
  @Output() menuToggle = new EventEmitter<void>();

  readonly currentUser = this.authService.currentUser;
  readonly isProfileMenuOpen = signal(false);
  readonly isNotificationsOpen = signal(false);

  readonly notifications = this.notificationsService.notifications;
  readonly unreadCount = this.notificationsService.unreadCount;

  readonly displayName = computed(
    () => this.currentUser()?.name ?? this.currentUser()?.username ?? 'Invitado',
  );

  readonly email = computed(() => this.currentUser()?.email ?? '');

  readonly initials = computed(() => {
    const source = this.displayName().trim();
    if (!source) {
      return '?';
    }

    const parts = source.split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const second = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + second).toUpperCase();
  });

  ngOnInit(): void {
    this.notificationsService.load();
  }

  toggleProfileMenu(): void {
    this.isProfileMenuOpen.update((value) => !value);
    this.isNotificationsOpen.set(false);
  }

  closeProfileMenu(): void {
    this.isProfileMenuOpen.set(false);
  }

  toggleNotifications(): void {
    this.isNotificationsOpen.update((value) => !value);
    this.isProfileMenuOpen.set(false);
    if (this.isNotificationsOpen()) {
      this.notificationsService.load();
    }
  }

  closeNotifications(): void {
    this.isNotificationsOpen.set(false);
  }

  markAllAsRead(): void {
    this.notificationsService.markAllAsRead();
  }

  relativeTime(date: Date): string {
    return this.notificationsService.relativeTime(date);
  }

  logout(): void {
    this.isProfileMenuOpen.set(false);
    this.authService.logout();
  }

  /** Cierra los menús si el clic ocurrió fuera del componente */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.isProfileMenuOpen.set(false);
      this.isNotificationsOpen.set(false);
    }
  }
}
