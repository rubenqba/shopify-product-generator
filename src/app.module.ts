import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { WeatherModule } from './weather/weather.module';
import configuration from './config/configuration';
import { McpModule } from '@rekog/mcp-nest';
import { StoreModule } from './store/store.module';
import { PromptLoaderService } from './common/prompt-loader.service';
import { CommonModule } from './common/common.module';

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
  ],
  controllers: [AppController],
  providers: [AppService, PromptLoaderService],
  exports: [PromptLoaderService],
})
export class AppModule {}
