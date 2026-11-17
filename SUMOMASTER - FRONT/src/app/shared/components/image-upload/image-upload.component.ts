import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

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
  @Input() hint = 'JPG, PNG o WebP. Se optimiza automáticamente.';

  @Output() valueChange = new EventEmitter<string>();

  error = '';

  private readonly maxInputBytes = 10 * 1024 * 1024;
  private readonly maxOutputBytes = 250 * 1024;
  private selectionId = 0;

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) return;

    const selection = ++this.selectionId;
    this.error = '';

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.error = 'Selecciona una imagen JPG, PNG o WebP.';
      return;
    }

    if (file.size > this.maxInputBytes) {
      this.error = 'El archivo original no debe superar 10 MB.';
      return;
    }

    try {
      const optimized = await this.optimize(file);
      const dataUrl = await this.readDataUrl(optimized);

      // Evita que una selección anterior reemplace una más reciente.
      if (selection === this.selectionId) {
        this.valueChange.emit(dataUrl);
      }
    } catch {
      if (selection === this.selectionId) {
        this.error = 'No se pudo optimizar la imagen. Prueba con otra.';
      }
    }
  }

  remove(): void {
    ++this.selectionId;
    this.error = '';
    this.valueChange.emit('');
  }

  private async optimize(file: File): Promise<Blob> {
    const url = URL.createObjectURL(file);
    const image = new Image();

    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Imagen inválida'));
        image.src = url;
      });

      const scale = Math.min(
        1,
        800 / image.naturalWidth,
        800 / image.naturalHeight,
      );

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas no disponible');

      // Fondo blanco para imágenes con transparencia al convertir a JPEG.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.85, 0.7, 0.55, 0.4, 0.25]) {
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (result) =>
              result
                ? resolve(result)
                : reject(new Error('Error de compresión')),
            'image/jpeg',
            quality,
          );
        });

        if (blob.size <= this.maxOutputBytes) return blob;
      }

      throw new Error('Imagen demasiado pesada');
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private readDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Error de lectura'));
      reader.readAsDataURL(blob);
    });
  }
}