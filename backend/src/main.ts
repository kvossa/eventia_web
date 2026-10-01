import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { UPLOADS_URL_PREFIX, UPLOAD_ROOT } from './common/uploads.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.set('trust proxy', Number(config.get<string>('TRUST_PROXY_HOPS') ?? 1));
  app.use(cookieParser());

  app.useStaticAssets(UPLOAD_ROOT, { prefix: `${UPLOADS_URL_PREFIX}/` });
  app.enableCors({
    origin: (config.get<string>('CORS_ORIGINS') ?? 'http://localhost:4200').split(','),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (config.get<string>('NODE_ENV') !== 'production' || config.get<string>('ENABLE_API_DOCS') === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Eventia API')
      .setDescription('Ticketing platform API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  app.enableShutdownHooks();

  await app.listen(Number(config.get('PORT') ?? 3000));
}
await bootstrap();