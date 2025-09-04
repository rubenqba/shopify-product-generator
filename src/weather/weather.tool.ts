import { Injectable } from '@nestjs/common';
import { WeatherService } from './weather.service';
import { Resource, Tool } from '@rekog/mcp-nest';
import { z } from 'zod';

@Injectable()
export class WeatherTool {
  constructor(private readonly weatherService: WeatherService) {}

  @Tool({
    name: 'get-weather',
    description: 'Get the current weather for a specific city',
    parameters: z.object({
      city: z.string().min(2).max(100),
    }),
  })
  async getWeather({ city }: { city: string }) {
    const weather = await this.weatherService.getWeather(city);

    return {
      content: [{ type: 'text', text: weather }],
    };
  }

  @Resource({
    uri: 'mcp://get-weather/{city}',
    name: 'Get Weather',
    description: 'Get the current weather for a specific city',
    mimeType: 'text/plain',
  })
  async getCurrentSchema({ uri, city }: { uri: string; city: string }) {
    return {
      contents: [
        {
          uri,
          mimeType: 'text/plain',
          text: JSON.stringify(await this.weatherService.getWeather(city)),
        },
      ],
    };
  }
}
