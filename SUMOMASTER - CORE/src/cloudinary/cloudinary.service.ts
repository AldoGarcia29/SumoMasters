import { Injectable } from '@nestjs/common';
import {
  v2 as cloudinary,
  UploadApiResponse,
  UploadApiErrorResponse,
} from 'cloudinary';

@Injectable()
export class CloudinaryService {
  uploadBase64(
    base64Image: string,
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        base64Image,
        { folder: 'sumomaster_robots' },
        (error, result) => {
          if (error) return reject(error);

          // Agregamos esta línea para asegurar que result no sea undefined
          if (!result)
            return reject(new Error('Cloudinary no devolvió un resultado'));

          resolve(result);
        },
      );
    });
  }
}
