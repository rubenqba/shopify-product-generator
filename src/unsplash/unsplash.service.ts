import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DownloadUrlSchema, UnsplashImageMinimal, UnsplashSearchResponseSchema } from './unsplash.dto';
import { AxiosError } from 'axios';
import { catchError, firstValueFrom, map } from 'rxjs';

@Injectable()
export class UnsplashService {
  private readonly log = new Logger(UnsplashService.name);

  constructor(
    private readonly httpService: HttpService,
    private config: ConfigService,
  ) {}

  async searchPhotos(
    query: string,
    { page, per_page }: { page?: number; per_page?: number } = {},
  ): Promise<UnsplashImageMinimal[]> {
    this.log.log(`Searching photos with query: ${query}`);
    const results = await firstValueFrom(
      this.httpService
        .get('https://api.unsplash.com/search/photos', {
          params: {
            query,
            page,
            per_page,
          },
          headers: {
            Authorization: `Client-ID ${this.config.getOrThrow('unsplash.access_key')}`,
          },
        })
        .pipe(
          map((response) => {
            const parsed = UnsplashSearchResponseSchema.safeParse(response.data);
            if (!parsed.success) {
              this.log.error('Invalid response from Unsplash API');
              throw new Error('Invalid response from Unsplash API');
            }
            return parsed.data.results;
          }),
          catchError((error: AxiosError) => {
            this.log.error(error.response?.data);
            throw new Error('An error happened!');
          }),
        ),
    );
    return results || [];
  }

  async getDownloadUrl(url: string): Promise<string> {
    this.log.log(`Retrieving download URL for: ${url}`);
    const results = await firstValueFrom(
      this.httpService
        .get(`https://api.unsplash.com/photos/${url}/download`, {
          headers: {
            Authorization: `Client-ID ${this.config.getOrThrow('unsplash.access_key')}`,
          },
        })
        .pipe(
          map((response) => {
            const parsed = DownloadUrlSchema.safeParse(response.data);
            if (!parsed.success) {
              this.log.error('Invalid response from Unsplash API');
              throw new Error('Invalid response from Unsplash API');
            }
            return parsed.data.url;
          }),
          catchError((error: AxiosError) => {
            this.log.error(error.response?.data);
            throw new Error('An error happened!');
          }),
        ),
    );
    return results;
  }
}
