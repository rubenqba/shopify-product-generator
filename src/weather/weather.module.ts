import { Module } from '@nestjs/common';
import { WeatherService } from './weather.service';
import { WeatherController } from './weather.controller';
import { WeatherTool } from './weather.tool';

@Module({
  providers: [WeatherService, WeatherTool],
  controllers: [WeatherController],
})
export class WeatherModule {}
