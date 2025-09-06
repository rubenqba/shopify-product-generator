import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WeatherModule } from './weather/weather.module';
import configuration from './config/configuration';
import { McpModule } from '@rekog/mcp-nest';
import { StoreModule } from './store/store.module';
import { PromptLoaderService } from './common/prompt-loader.service';
import { CommonModule } from './common/common.module';
import { UnsplashModule } from './unsplash/unsplash.module';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { HttpExceptionFilter } from './common/zod-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env.local', '.env'],
      load: [configuration],
      isGlobal: true,
    }),
    WeatherModule,
    McpModule.forRoot({
      name: 'my-shopify-service',
      version: '1.0.0',
    }),
    StoreModule,
    CommonModule,
    UnsplashModule,
  ],
  controllers: [],
  providers: [
    PromptLoaderService,
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ZodSerializerInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
  exports: [PromptLoaderService],
})
export class AppModule {}
