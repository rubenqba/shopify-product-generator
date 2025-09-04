import { Injectable } from '@nestjs/common';

@Injectable()
export class WeatherService {
  async getWeather(city: string): Promise<string> {
    return Promise.resolve(`The weather in ${city} is sunny at 92°F.`);
  }
}
