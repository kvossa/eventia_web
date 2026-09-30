import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { UPLOADS_URL_PREFIX, UPLOAD_ROOT } from '../src/common/uploads.js';

export function configureTestApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.useStaticAssets(UPLOAD_ROOT, { prefix: `${UPLOADS_URL_PREFIX}/` });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
