import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Selector de imagen pequeño y reutilizable.
 * Convierte el archivo elegido a base64 (data URL) y lo emite mediante
 * `valueChange`, para poder guardarlo directamente como string en el
 * documento de Mongo sin necesitar un servicio de almacenamiento aparte.
 */
@Component({
  selector: 'app-image-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-upload.component.html',
  styleUrl: './image-upload.component.scss',
})
export class ImageUploadComponent {
  @Input() value: string | null | undefined = '';
  @Input() shape: 'circle' | 'square' = 'circle';
  @Input() fallbackText = '';
  @Input() hint = 'PNG o JPG, máx. 2MB';

  @Output() valueChange = new EventEmitter<string>();

  error = '';

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) return;

    this.error = '';

    if (!file.type.startsWith('image/')) {
      this.error = 'El archivo debe ser una imagen.';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      this.error = 'La imagen no debe superar 2MB.';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.valueChange.emit(reader.result as string);
    };
    reader.onerror = () => {
      this.error = 'No se pudo leer la imagen.';
    };
    reader.readAsDataURL(file);
  }

  remove(): void {
    this.valueChange.emit('');
  }
}
