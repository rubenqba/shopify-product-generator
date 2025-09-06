import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { UnsplashService } from './unsplash.service';

@Controller('unsplash')
export class UnsplashController {
  constructor(private readonly unsplashService: UnsplashService) {}

  @Get('image/search')
  searchImages(@Query('query') query: string, @Query('size') size: number) {
    return this.unsplashService.searchPhotos(query, { per_page: size });
  }

  @Post('image/download')
  downloadImage(@Body('url') url: string) {
    if (!url) {
      throw new Error('URL is required');
    }
    return this.unsplashService.getDownloadUrl(url);
  }
}
