import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { TopbarComponent } from '../../shared/components/topbar/topbar.component';
import { TorneoResumen } from '../models/live.model';
import { PublicApiService } from '../services/public-api.service';

@Component({
  selector: 'app-torneos-publicos',
  standalone: true,
  imports: [CommonModule, RouterLink, SidebarComponent, TopbarComponent],
  templateUrl: './torneos-publicos.component.html',
  styleUrls: ['./torneos-publicos.component.css'],
})
export class TorneosPublicosComponent implements OnInit {
  readonly sidebarOpen = signal(false);
  lista: TorneoResumen[] | null = null;
  error = false;

  constructor(private api: PublicApiService) {}

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  ngOnInit(): void {
    this.api.getTorneos().subscribe({
      next: (l) => (this.lista = l),
      error: () => (this.error = true),
    });
  }
}
