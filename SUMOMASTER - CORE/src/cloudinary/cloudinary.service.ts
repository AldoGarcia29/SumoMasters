import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  uploadBase64(
    base64Image: string,
    folder = 'sumomaster_robots',
  ): Promise<UploadApiResponse | null> {
    const requiredSettings = [
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
    ];
    const missingSettings = requiredSettings.filter(
      (setting) => !process.env[setting]?.trim(),
    );

    if (missingSettings.length) {
      this.logger.warn(
        `Cloudinary no está configurado; se omitió la imagen. Faltan: ${missingSettings.join(', ')}`,
      );
      return Promise.resolve(null);
    }

    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(base64Image, { folder }, (error, result) => {
        if (error) return reject(error);

        if (!result)
          return reject(new Error('Cloudinary no devolvió un resultado'));

        resolve(result);
      });
    });
  }
}
