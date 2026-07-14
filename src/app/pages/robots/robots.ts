import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { RobotsService } from '../../core/services/robots.service';
import { EquiposService } from '../../core/services/equipos.service';

import {
  CrearRobot,
  EquipoResumen,
  EstadoRobot,
  Robot,
} from '../../core/interfaces/robot.interface';

import { Equipo } from '../../core/interfaces/equipo.interface';

@Component({
  selector: 'app-robots',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
  ],
  templateUrl: './robots.html',
  styleUrl: './robots.scss',
})
export class Robots implements OnInit {
  private readonly robotsService = inject(RobotsService);
  private readonly equiposService = inject(EquiposService);
  private readonly formBuilder = inject(FormBuilder);

  readonly robots = signal<Robot[]>([]);
  readonly equipos = signal<Equipo[]>([]);
  readonly busqueda = signal('');
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly modalAbierto = signal(false);
  readonly robotEditando = signal<Robot | null>(null);

  readonly estados: EstadoRobot[] = [
    'activo',
    'eliminado',
    'en espera',
    'retirado',
  ];

  readonly formulario = this.formBuilder.nonNullable.group({
    nombreRobot: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
      ],
    ],
    equipoId: ['', Validators.required],
    categoriaId: [
      '',
      [
        Validators.required,
        Validators.pattern(/^[a-fA-F0-9]{24}$/),
      ],
    ],
    peso: [
      0,
      [
        Validators.required,
        Validators.min(0),
      ],
    ],
    fuerza: [
      0,
      [
        Validators.required,
        Validators.min(0),
      ],
    ],
    estado: ['en espera' as EstadoRobot, Validators.required],
    imagenUrl: [''],
  });

  readonly fuerzaNetaPrevia = computed(() => {
    const peso = Number(this.formulario.controls.peso.value);
    const fuerza = Number(this.formulario.controls.fuerza.value);

    return fuerza - peso;
  });

  readonly robotsFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();

    if (!texto) {
      return this.robots();
    }

    return this.robots().filter((robot) => {
      const equipo = this.obtenerNombreEquipo(robot);

      return (
        robot.nombreRobot.toLowerCase().includes(texto) ||
        equipo.toLowerCase().includes(texto) ||
        robot.estado.toLowerCase().includes(texto)
      );
    });
  });

  ngOnInit(): void {
    this.cargarRobots();
    this.cargarEquipos();
  }

  cargarRobots(): void {
    this.cargando.set(true);
    this.error.set('');

    this.robotsService.obtenerTodos().subscribe({
      next: (robots) => {
        this.robots.set(robots);
        this.cargando.set(false);
      },
      error: (error) => {
        console.error(error);
        this.error.set(
          'No se pudieron cargar los robots. Verifica el backend.',
        );
        this.cargando.set(false);
      },
    });
  }

  cargarEquipos(): void {
    this.equiposService.obtenerTodos().subscribe({
      next: (equipos) => {
        this.equipos.set(equipos);
      },
      error: (error) => {
        console.error(
          'No se pudieron cargar los equipos:',
          error,
        );
      },
    });
  }

  buscar(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.busqueda.set(input.value);
  }

  nuevoRobot(): void {
    if (this.equipos().length === 0) {
      alert(
        'Primero debes registrar al menos un equipo.',
      );
      return;
    }

    this.robotEditando.set(null);

    this.formulario.reset({
      nombreRobot: '',
      equipoId: '',
      categoriaId: '',
      peso: 0,
      fuerza: 0,
      estado: 'en espera',
      imagenUrl: '',
    });

    this.modalAbierto.set(true);
  }

  editarRobot(robot: Robot): void {
    this.robotEditando.set(robot);

    this.formulario.setValue({
      nombreRobot: robot.nombreRobot,
      equipoId: this.obtenerEquipoId(robot),
      categoriaId: this.obtenerCategoriaId(robot.categoriaId),
      peso: robot.peso,
      fuerza: robot.fuerza,
      estado: robot.estado,
      imagenUrl: robot.imagenUrl ?? '',
    });

    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    if (this.guardando()) {
      return;
    }

    this.modalAbierto.set(false);
    this.robotEditando.set(null);
  }

  guardarRobot(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const valores = this.formulario.getRawValue();

    if (valores.fuerza - valores.peso < 0) {
      alert(
        'La fuerza no puede ser menor que el peso porque la fuerza neta sería negativa.',
      );
      return;
    }

    const datos: CrearRobot = {
      nombreRobot: valores.nombreRobot.trim(),
      equipoId: valores.equipoId,
      categoriaId: valores.categoriaId.trim(),
      peso: Number(valores.peso),
      fuerza: Number(valores.fuerza),
      estado: valores.estado,
    };

    const imagenUrl = valores.imagenUrl.trim();

    if (imagenUrl) {
      datos.imagenUrl = imagenUrl;
    }

    this.guardando.set(true);

    const robotActual = this.robotEditando();

    const solicitud = robotActual
      ? this.robotsService.actualizar(robotActual._id, datos)
      : this.robotsService.crear(datos);

    solicitud.subscribe({
      next: () => {
        this.guardando.set(false);
        this.cerrarModal();

        // Se vuelve a consultar para recibir equipoId poblado.
        this.cargarRobots();
      },
      error: (error) => {
        console.error(error);
        this.guardando.set(false);

        const mensaje =
          error?.error?.message ??
          'No se pudo guardar el robot.';

        alert(
          Array.isArray(mensaje)
            ? mensaje.join('\n')
            : mensaje,
        );
      },
    });
  }

  verRobot(robot: Robot): void {
    alert(
      `Robot: ${robot.nombreRobot}\n` +
      `Equipo: ${this.obtenerNombreEquipo(robot)}\n` +
      `Peso: ${robot.peso}\n` +
      `Fuerza: ${robot.fuerza}\n` +
      `Fuerza neta: ${robot.fuerzaNeta}\n` +
      `Estado: ${robot.estado}`,
    );
  }

  eliminarRobot(robot: Robot): void {
    const confirmar = confirm(
      `¿Deseas eliminar el robot "${robot.nombreRobot}"?`,
    );

    if (!confirmar) {
      return;
    }

    this.robotsService.eliminar(robot._id).subscribe({
      next: () => {
        this.robots.update((robots) =>
          robots.filter((item) => item._id !== robot._id),
        );
      },
      error: (error) => {
        console.error(error);
        alert('No se pudo eliminar el robot.');
      },
    });
  }

  obtenerNombreEquipo(robot: Robot): string {
    if (typeof robot.equipoId === 'string') {
      const equipo = this.equipos().find(
        (item) => item._id === robot.equipoId,
      );

      return equipo?.nombreEquipo ?? robot.equipoId;
    }

    return robot.equipoId.nombreEquipo;
  }

  obtenerEquipoId(robot: Robot): string {
    return typeof robot.equipoId === 'string'
      ? robot.equipoId
      : robot.equipoId._id;
  }

  obtenerCategoria(
    categoriaId:
      | string
      | {
          _id?: string;
          nombre?: string;
        },
  ): string {
    if (typeof categoriaId !== 'string') {
      return categoriaId.nombre ?? 'Sin categoría';
    }

    return `Categoría ${categoriaId.slice(-4)}`;
  }

  private obtenerCategoriaId(
    categoriaId:
      | string
      | {
          _id?: string;
        },
  ): string {
    return typeof categoriaId === 'string'
      ? categoriaId
      : categoriaId._id ?? '';
  }
}