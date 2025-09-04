import { Body, Controller } from '@nestjs/common';
import { WeatherService } from './weather.service';

@Controller('weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  getWeather(@Body('city') city: string) {
    return this.weatherService.getWeather(city);
  }
}
