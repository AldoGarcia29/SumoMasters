import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TorneoResumen } from '../models/live.model';
import { PublicApiService } from '../services/public-api.service';

@Component({
  selector: 'app-torneos-publicos',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './torneos-publicos.component.html',
  styleUrls: ['./torneos-publicos.component.css'],
})
export class TorneosPublicosComponent implements OnInit {
  lista: TorneoResumen[] | null = null;
  error = false;

  constructor(private api: PublicApiService) {}

  ngOnInit(): void {
    this.api.getTorneos().subscribe({
      next: (l) => (this.lista = l),
      error: () => (this.error = true),
    });
  }
}
