import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['log', 'error', 'warn', 'debug', 'verbose'],
  });
  app.setGlobalPrefix('api/v1', { exclude: ['mcp', 'sse', 'messages'] });
  await app.listen(process.env.PORT ?? 5080);
}
bootstrap();
