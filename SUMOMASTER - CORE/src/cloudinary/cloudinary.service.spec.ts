import { Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryService } from './cloudinary.service';

describe('CloudinaryService', () => {
  const settingNames = [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
  ] as const;
  const originalSettings = new Map(
    settingNames.map((setting) => [setting, process.env[setting]]),
  );

  afterEach(() => {
    for (const setting of settingNames) {
      const originalValue = originalSettings.get(setting);
      if (originalValue === undefined) {
        delete process.env[setting];
      } else {
        process.env[setting] = originalValue;
      }
    }
    jest.restoreAllMocks();
  });

  it('omits the upload and warns when Cloudinary settings are missing', async () => {
    for (const setting of settingNames) {
      delete process.env[setting];
    }

    const uploadSpy = jest.spyOn(cloudinary.uploader, 'upload');
    const warningSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const service = new CloudinaryService();

    await expect(
      service.uploadBase64('data:image/png;base64,abc'),
    ).resolves.toBe(null);

    expect(uploadSpy).not.toHaveBeenCalled();
    expect(warningSpy).toHaveBeenCalledWith(
      expect.stringContaining('CLOUDINARY_CLOUD_NAME'),
    );
    expect(warningSpy).toHaveBeenCalledWith(
      expect.stringContaining('CLOUDINARY_API_KEY'),
    );
    expect(warningSpy).toHaveBeenCalledWith(
      expect.stringContaining('CLOUDINARY_API_SECRET'),
    );
  });
});
