import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { RobotFichaModalComponent } from './shared/components/robot-ficha-modal/robot-ficha-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RobotFichaModalComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'sumo-masters-front';
}
