import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { CategoriasService } from '../../core/services/categorias.service';
import { EquiposService } from '../../core/services/equipos.service';

import { Categoria } from '../../core/interfaces/categoria.interface';
import {
  CrearEquipo,
  Equipo,
} from '../../core/interfaces/equipo.interface';

@Component({
  selector: 'app-equipos',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
  ],
  templateUrl: './equipos.html',
  styleUrl: './equipos.scss',
})
export class Equipos implements OnInit {
  private readonly equiposService = inject(EquiposService);
  private readonly categoriasService = inject(CategoriasService);
  private readonly formBuilder = inject(FormBuilder);

  readonly equipos = signal<Equipo[]>([]);
  readonly categorias = signal<Categoria[]>([]);

  readonly busqueda = signal('');
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly error = signal('');

  readonly modalAbierto = signal(false);
  readonly equipoEditando = signal<Equipo | null>(null);

  readonly formulario = this.formBuilder.nonNullable.group({
    nombreEquipo: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
      ],
    ],

    institucion: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
      ],
    ],

    integrantesTexto: [
      '',
      Validators.required,
    ],

    categoriaId: [
      '',
      Validators.required,
    ],

    torneoId: [
      '',
      [
        Validators.required,
        Validators.pattern(/^[a-fA-F0-9]{24}$/),
      ],
    ],
  });

  readonly equiposFiltrados = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();

    if (!texto) {
      return this.equipos();
    }

    return this.equipos().filter((equipo) => {
      const categoria = this.obtenerCategoria(
        equipo.categoriaId,
      ).toLowerCase();

      return (
        equipo.nombreEquipo
          .toLowerCase()
          .includes(texto) ||
        equipo.institucion
          .toLowerCase()
          .includes(texto) ||
        categoria.includes(texto)
      );
    });
  });

  ngOnInit(): void {
    this.cargarEquipos();
    this.cargarCategorias();
  }

  cargarEquipos(): void {
    this.cargando.set(true);
    this.error.set('');

    this.equiposService.obtenerTodos().subscribe({
      next: (equipos) => {
        this.equipos.set(equipos);
        this.cargando.set(false);
      },

      error: (error) => {
        console.error(
          'Error al cargar equipos:',
          error,
        );

        this.error.set(
          'No se pudieron cargar los equipos. Verifica que el backend esté encendido.',
        );

        this.cargando.set(false);
      },
    });
  }

  cargarCategorias(): void {
    this.categoriasService.obtenerActivas().subscribe({
      next: (categorias) => {
        this.categorias.set(categorias);
      },

      error: (error) => {
        console.error(
          'No se pudieron cargar las categorías:',
          error,
        );
      },
    });
  }

  buscar(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.busqueda.set(input.value);
  }

  nuevoEquipo(): void {
    this.equipoEditando.set(null);

    this.formulario.reset({
      nombreEquipo: '',
      institucion: '',
      integrantesTexto: '',
      categoriaId: '',
      torneoId: '',
    });

    this.modalAbierto.set(true);
  }

  editarEquipo(equipo: Equipo): void {
    this.equipoEditando.set(equipo);

    this.formulario.setValue({
      nombreEquipo: equipo.nombreEquipo,
      institucion: equipo.institucion,
      integrantesTexto: equipo.integrantes.join(', '),
      categoriaId: this.obtenerId(equipo.categoriaId),
      torneoId: this.obtenerId(equipo.torneoId),
    });

    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    if (this.guardando()) {
      return;
    }

    this.modalAbierto.set(false);
    this.equipoEditando.set(null);

    this.formulario.reset({
      nombreEquipo: '',
      institucion: '',
      integrantesTexto: '',
      categoriaId: '',
      torneoId: '',
    });
  }

  guardarEquipo(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const valores = this.formulario.getRawValue();

    const integrantes = valores.integrantesTexto
      .split(',')
      .map((integrante) => integrante.trim())
      .filter((integrante) => integrante.length > 0);

    if (integrantes.length === 0) {
      this.formulario.controls.integrantesTexto.setErrors({
        required: true,
      });

      return;
    }

    const datos: CrearEquipo = {
      nombreEquipo: valores.nombreEquipo.trim(),
      institucion: valores.institucion.trim(),
      integrantes,
      categoriaId: valores.categoriaId,
      torneoId: valores.torneoId.trim(),
    };

    this.guardando.set(true);

    const equipoActual = this.equipoEditando();

    const solicitud = equipoActual
      ? this.equiposService.actualizar(
          equipoActual._id,
          datos,
        )
      : this.equiposService.crear(datos);

    solicitud.subscribe({
      next: (equipoGuardado) => {
        if (equipoActual) {
          this.equipos.update((equipos) =>
            equipos.map((equipo) =>
              equipo._id === equipoGuardado._id
                ? equipoGuardado
                : equipo,
            ),
          );
        } else {
          this.equipos.update((equipos) => [
            equipoGuardado,
            ...equipos,
          ]);
        }

        this.guardando.set(false);
        this.cerrarModal();
      },

      error: (error) => {
        console.error(
          'Error al guardar equipo:',
          error,
        );

        this.guardando.set(false);

        const mensaje =
          error?.error?.message ??
          'No se pudo guardar el equipo.';

        alert(
          Array.isArray(mensaje)
            ? mensaje.join('\n')
            : mensaje,
        );
      },
    });
  }

  verEquipo(equipo: Equipo): void {
    alert(
      `Equipo: ${equipo.nombreEquipo}\n` +
      `Institución: ${equipo.institucion}\n` +
      `Categoría: ${this.obtenerCategoria(equipo.categoriaId)}\n` +
      `Integrantes: ${equipo.integrantes.join(', ')}`,
    );
  }

  eliminarEquipo(equipo: Equipo): void {
    const confirmar = confirm(
      `¿Deseas eliminar el equipo "${equipo.nombreEquipo}"?`,
    );

    if (!confirmar) {
      return;
    }

    this.equiposService.eliminar(equipo._id).subscribe({
      next: () => {
        this.equipos.update((equipos) =>
          equipos.filter(
            (item) => item._id !== equipo._id,
          ),
        );
      },

      error: (error) => {
        console.error(
          'Error al eliminar equipo:',
          error,
        );

        alert('No se pudo eliminar el equipo.');
      },
    });
  }

  obtenerInicial(nombre: string): string {
    return nombre.trim().charAt(0).toUpperCase();
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

    const categoria = this.categorias().find(
      (item) => item._id === categoriaId,
    );

    return categoria?.nombre ?? 'Sin categoría';
  }

  private obtenerId(
    valor:
      | string
      | {
          _id?: string;
        },
  ): string {
    return typeof valor === 'string'
      ? valor
      : valor._id ?? '';
  }
}