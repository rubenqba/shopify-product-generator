import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1', { exclude: ['mcp', 'sse', 'messages'] });
  await app.listen(process.env.PORT ?? 5080);
}
bootstrap();
